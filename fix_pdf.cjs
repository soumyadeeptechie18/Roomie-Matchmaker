const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

if (!code.includes("import { jsPDF }")) {
    code = code.replace(
        "import { supabase } from './lib/supabase';",
        "import { supabase } from './lib/supabase';\nimport { jsPDF } from 'jspdf';\nimport autoTable from 'jspdf-autotable';\nimport { Download } from 'lucide-react';"
    );
}

const functionStr = `  const generatePDF = () => {
    const doc = new jsPDF();
    let currentY = 14;
    
    doc.setFontSize(20);
    doc.text("Roommate Registrations (Branch-wise)", 14, currentY);
    currentY += 10;
    
    Object.entries(registrationsByBranch)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([branch, groups]) => {
        
        doc.setFontSize(16);
        doc.text(branch, 14, currentY + 10);
        currentY += 14;
        
        const tableBody = groups.map(group => {
            const studentStr = \`\${group.student.Name}\\n(\${group.student['Reg. No.']})\`;
            const roommatesStr = group.roommates.map(rm => rm ? \`\${rm.Name} (\${rm.Program})\` : 'Unknown').join('\\n');
            return [studentStr, roommatesStr];
        });
        
        autoTable(doc, {
            startY: currentY,
            head: [['Registered By', 'Preferred Roommates']],
            body: tableBody,
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 3 },
            headStyles: { fillColor: [41, 128, 185] }
        });
        
        currentY = (doc as any).lastAutoTable.finalY + 10;
        
        if (currentY > 250) {
            doc.addPage();
            currentY = 14;
        }
    });
    
    doc.save("registrations.pdf");
  };`;

const searchDashboard = `              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <LayoutDashboard size={20} className="text-slate-400" />
                Live Dashboard
              </h2>`;

const replaceDashboard = `              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <LayoutDashboard size={20} className="text-slate-400" />
                Live Dashboard
              </h2>
              <button 
                onClick={generatePDF}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors border border-blue-500 shadow-lg flex items-center gap-2 text-sm"
              >
                <Download size={16} /> Download PDF
              </button>`;

if (code.includes('Live Dashboard') && !code.includes('generatePDF = () =>')) {
    code = code.replace("  return (", functionStr + "\n\n  return (");
    code = code.replace(searchDashboard, replaceDashboard);
    fs.writeFileSync('src/App.tsx', code);
    console.log("Updated!");
} else {
    console.log("Already updated or not found.");
}
