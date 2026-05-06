import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Player } from '../types';

export const exportRankingToPDF = (players: Player[]) => {
  const doc = new jsPDF();

  // Add Title
  doc.setFontSize(20);
  doc.setTextColor(40);
  doc.text('Ranking Geral - Arena BT', 14, 22);

  // Add Date
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 14, 30);

  // Prepare table data
  const sortedPlayers = [...players]
    .filter(p => p.role !== 'admin')
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.name.localeCompare(b.name);
    });

  const tableData = sortedPlayers.map((p, index) => [
    index + 1,
    p.name,
    p.matchesPlayed,
    p.wins,
    p.losses,
    p.points
  ]);

  // Generate Table
  autoTable(doc, {
    startY: 35,
    head: [['Pos', 'Nome', 'Partidas', 'Vitórias', 'Derrotas', 'Pontos']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [45, 212, 191] }, // Teal color matching the brand
    styles: { fontSize: 10, cellPadding: 5 },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center', fontStyle: 'bold' }
    }
  });

  // Save the PDF
  doc.save(`ranking_arena_bt_${new Date().toISOString().split('T')[0]}.pdf`);
};
