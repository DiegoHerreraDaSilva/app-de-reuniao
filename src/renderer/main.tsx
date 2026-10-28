import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import Toast from './Toast'

// Tema escuro por padrão; o index.html já nasce com a classe, aqui só respeita a escolha salva.
try { if (localStorage.getItem('theme') === 'light') document.documentElement.classList.remove('dark') } catch { /* sem storage */ }

// A janela de aviso (canto da tela) usa a mesma página na rota #toast, com fundo transparente.
const toast = location.hash === '#toast'
if (toast) document.documentElement.classList.add('toast-mode')

createRoot(document.getElementById('root')!).render(toast ? <Toast /> : <App />)
