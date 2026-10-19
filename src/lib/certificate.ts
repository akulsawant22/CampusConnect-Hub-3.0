export async function downloadCertificate(opts: {
  name: string;
  event: string;
  date: string;
  serial: string;
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(40, 180, 200);
  doc.setLineWidth(3);
  doc.rect(30, 30, w - 60, h - 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(90);
  doc.text("CAMPUSCONNECT", w / 2, 100, { align: "center" });
  doc.setFontSize(34);
  doc.setTextColor(20);
  doc.text("Certificate of Participation", w / 2, 160, { align: "center" });
  doc.setFontSize(14);
  doc.setTextColor(90);
  doc.text("This certifies that", w / 2, 220, { align: "center" });
  doc.setFontSize(28);
  doc.setTextColor(20);
  doc.text(opts.name || "Participant", w / 2, 265, { align: "center" });
  doc.setFontSize(14);
  doc.setTextColor(90);
  doc.text("attended", w / 2, 305, { align: "center" });
  doc.setFontSize(20);
  doc.setTextColor(20);
  doc.text(opts.event, w / 2, 340, { align: "center", maxWidth: w - 160 });
  doc.setFontSize(11);
  doc.setTextColor(110);
  doc.text(`Date: ${opts.date}`, 70, h - 70);
  doc.text(`Serial: ${opts.serial}`, w - 70, h - 70, { align: "right" });
  doc.save(`certificate-${opts.serial}.pdf`);
}
