const xl = require('excel4node');

module.exports = function(translationMap, from, to) {

    let wb = new xl.Workbook();

    let ws = wb.addWorksheet('Translations');

    var style = wb.createStyle({
        font: {
            color: '#FF0800',
            size: 12
        },
        numberFormat: '$#,##0.00; ($#,##0.00); -'
    });
    
    var headerStyle = wb.createStyle({
        font: {
            color: '#FF0800',
            size: 14
        },
        numberFormat: '$#,##0.00; ($#,##0.00); -'
    });

    ws.cell(1,1).string("serviceName").style(headerStyle);
    ws.cell(1,2).string("componentId").style(headerStyle);
    ws.cell(1,3).string("key").style(headerStyle);
    ws.cell(1,4).string("direction").style(headerStyle);
    ws.cell(1,5).string("languageId").style(headerStyle);
    ws.cell(1,6).string("text").style(headerStyle);
    let row = 2; 
    for (let tkey in translationMap) {
      ws.cell(row, 3).string(tkey);
      ws.cell(row, 4).string("from");
      ws.cell(row, 5).string(from);
      ws.cell(row, 6).string(translationMap[tkey][from]);
      ws.cell(row+1, 4).string("to");
      ws.cell(row+1, 5).string(to);
      ws.cell(row+1, 6).string(translationMap[tkey][to]);
      row+=2;
    }
    

    let fileName = 'Translations_' + to + '.xlsx';
    wb.write(fileName);
    return Promise.resolve(fileName);
}


