import { Document, HeadingLevel, Packer, Paragraph } from 'docx'

// Converte o Markdown da ata (títulos # e listas -) em DOCX.
export async function mdToDocx(md: string): Promise<Buffer> {
  const levels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3]
  const children = md.split(/\r?\n/).filter(l => l.trim()).map(l => {
    const h = /^(#{1,3})\s+(.*)/.exec(l)
    if (h) return new Paragraph({ text: h[2], heading: levels[h[1].length - 1] })
    const b = /^\s*[-*]\s+(.*)/.exec(l)
    return b ? new Paragraph({ text: b[1], bullet: { level: 0 } }) : new Paragraph(l)
  })
  return Packer.toBuffer(new Document({ sections: [{ children }] }))
}
