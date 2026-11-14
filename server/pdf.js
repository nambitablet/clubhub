import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export async function certificatePdf(c, verifyUrl) {
  const qr = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 240, color: { dark: '#0f172a', light: '#ffffff' } });
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, info: { Title: `Certificate ${c.code}`, Author: 'ClubHub · RVCE' } });
    const chunks = [];
    doc.on('data', (b) => chunks.push(b)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    const W = doc.page.width; const H = doc.page.height;
    const volunteer = c.type === 'volunteer';

    // background & frame
    doc.rect(0, 0, W, H).fill('#fdfcf8');
    const grad = doc.linearGradient(0, 0, W, 0); grad.stop(0, c.color || '#4f46e5').stop(1, c.color2 || '#7c3aed');
    doc.rect(0, 0, W, 14).fill(grad); doc.rect(0, H - 14, W, 14).fill(grad);
    doc.lineWidth(1.2).strokeColor('#d6c79a').rect(28, 34, W - 56, H - 68).stroke();
    doc.lineWidth(0.5).strokeColor('#e7dcb8').rect(36, 42, W - 72, H - 84).stroke();
    // corner ornaments
    for (const [x, y] of [[36, 42], [W - 36, 42], [36, H - 42], [W - 36, H - 42]]) doc.circle(x, y, 4).fill('#c8a951');

    // header
    doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(10).text('RV COLLEGE OF ENGINEERING®  ·  BENGALURU', 0, 70, { width: W, align: 'center', characterSpacing: 2 });
    doc.fillColor(c.color || '#4f46e5').font('Helvetica-Bold').fontSize(14).text(c.club_name.toUpperCase(), 0, 90, { width: W, align: 'center', characterSpacing: 1.5 });

    doc.fillColor('#0f172a').font('Times-Bold').fontSize(40).text(volunteer ? 'Certificate of Appreciation' : 'Certificate of Participation', 0, 130, { width: W, align: 'center' });
    doc.moveTo(W / 2 - 60, 182).lineTo(W / 2 + 60, 182).lineWidth(1.5).strokeColor('#c8a951').stroke();

    doc.fillColor('#475569').font('Helvetica').fontSize(13).text('This is to certify that', 0, 205, { width: W, align: 'center' });
    doc.fillColor('#0f172a').font('Times-BoldItalic').fontSize(34).text(c.student_name, 0, 228, { width: W, align: 'center' });
    const sub = [c.usn, c.branch ? `Dept. code ${c.branch}` : null].filter(Boolean).join('  ·  ');
    if (sub) doc.fillColor('#64748b').font('Helvetica').fontSize(10).text(sub, 0, 270, { width: W, align: 'center' });

    const body = volunteer
      ? `has served as a volunteer${c.detail ? ` (${c.detail})` : ''} for ${c.hours ? `${c.hours} hour${c.hours === 1 ? '' : 's'} ` : ''}at`
      : 'has successfully participated in';
    doc.fillColor('#334155').font('Helvetica').fontSize(13).text(body, 90, 296, { width: W - 180, align: 'center' });
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(19).text(`“${c.event_title}”`, 90, 320, { width: W - 180, align: 'center' });
    doc.fillColor('#334155').font('Helvetica').fontSize(12).text(`organised by ${c.club_name} on ${fmt(c.start_at)}${c.venue ? ` at ${c.venue}` : ''}.`, 90, 350, { width: W - 180, align: 'center' });

    // signatures
    const sy = H - 140;
    for (const [x, label, sub2] of [[110, 'Club President', c.club_name], [W - 330, 'Faculty Coordinator', 'RV College of Engineering']]) {
      doc.moveTo(x, sy).lineTo(x + 220, sy).lineWidth(0.8).strokeColor('#94a3b8').stroke();
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text(label, x, sy + 8, { width: 220, align: 'center' });
      doc.fillColor('#64748b').font('Helvetica').fontSize(9).text(sub2, x, sy + 23, { width: 220, align: 'center' });
    }
    // seal + QR
    const cx = W / 2; const cy = H - 128;
    doc.circle(cx, cy, 44).fill(grad);
    doc.circle(cx, cy, 37).lineWidth(1).strokeColor('#ffffff').stroke();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text('CLUBHUB', cx - 40, cy - 12, { width: 80, align: 'center' });
    doc.font('Helvetica').fontSize(7).text('VERIFIED', cx - 40, cy + 2, { width: 80, align: 'center', characterSpacing: 2 });

    doc.image(qr, W - 128, 58, { width: 66 });
    doc.fillColor('#64748b').font('Helvetica').fontSize(7).text('Scan to verify', W - 132, 126, { width: 74, align: 'center' });

    doc.fillColor('#475569').font('Helvetica').fontSize(8.5)
      .text(`Certificate ID: ${c.code}   ·   Issued ${fmt(c.issued_at)}   ·   Verify at ${verifyUrl.replace(/\/verify\/.*/, '')}/verify`, 0, H - 60, { width: W, align: 'center' });
    doc.end();
  });
}
