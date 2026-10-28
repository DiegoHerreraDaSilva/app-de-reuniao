// Lista os processos com sessão de captura ativa em algum microfone, via WASAPI (a mesma fonte do ícone
// "aplicativos usando seu microfone" da bandeja). O registro ConsentStore não serve: no Windows 11 recente
// ele não é atualizado em tempo real. Um PowerShell fica vivo imprimindo "MIC:a.exe;b.exe" a cada 2 s,
// porque compilar o C# a cada consulta levaria ~5 s.
const CSHARP = `
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

public static class MicSessions
{
    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class Enumerator {}

    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator {
        int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection devices);
    }
    [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceCollection {
        int GetCount(out int count);
        int Item(int index, out IMMDevice device);
    }
    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice {
        int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
    }
    [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionManager2 {
        int GetAudioSessionControl(IntPtr a, int b, out IntPtr c);
        int GetSimpleAudioVolume(IntPtr a, int b, out IntPtr c);
        int GetSessionEnumerator(out IAudioSessionEnumerator e);
    }
    [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionEnumerator {
        int GetCount(out int count);
        int GetSession(int index, out IAudioSessionControl2 session);
    }
    [ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionControl2 {
        int GetState(out int state);
        int GetDisplayName(out IntPtr name);
        int SetDisplayName(IntPtr name, IntPtr ctx);
        int GetIconPath(out IntPtr path);
        int SetIconPath(IntPtr path, IntPtr ctx);
        int GetGroupingParam(out Guid g);
        int SetGroupingParam(ref Guid g, IntPtr ctx);
        int RegisterAudioSessionNotification(IntPtr n);
        int UnregisterAudioSessionNotification(IntPtr n);
        int GetSessionIdentifier(out IntPtr id);
        int GetSessionInstanceIdentifier(out IntPtr id);
        int GetProcessId(out uint pid);
        int IsSystemSoundsSession();
        int SetDuckingPreference(bool optOut);
    }

    public static string[] ActiveCaptureProcesses()
    {
        var names = new HashSet<string>();
        var en = (IMMDeviceEnumerator)new Enumerator();
        IMMDeviceCollection devices;
        en.EnumAudioEndpoints(1 /*eCapture*/, 1 /*ACTIVE*/, out devices);
        int n; devices.GetCount(out n);
        var iid = typeof(IAudioSessionManager2).GUID;
        for (int i = 0; i < n; i++)
        {
            IMMDevice dev; devices.Item(i, out dev);
            object o; dev.Activate(ref iid, 23 /*CLSCTX_ALL*/, IntPtr.Zero, out o);
            IAudioSessionEnumerator se; ((IAudioSessionManager2)o).GetSessionEnumerator(out se);
            int c; se.GetCount(out c);
            for (int j = 0; j < c; j++)
            {
                IAudioSessionControl2 s; se.GetSession(j, out s);
                int state; s.GetState(out state);
                if (state != 1) continue; // 1 = AudioSessionStateActive
                uint pid; s.GetProcessId(out pid);
                try { names.Add(Process.GetProcessById((int)pid).ProcessName + ".exe"); } catch { }
            }
        }
        var arr = new string[names.Count]; names.CopyTo(arr); return arr;
    }
}
`

export const SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
${CSHARP}
'@
while ($true) {
  try { Write-Output ('MIC:' + [string]::Join(';', [MicSessions]::ActiveCaptureProcesses())) } catch { Write-Output 'MIC:' }
  Start-Sleep -Seconds 2
}
`
