const xl = require('excel4node');

module.exports = function(translationMap, from, to) {

    let wb = new xl.Workbook();

    let ws = wb.addWorksheet('Translations');

    var style = wb.createStyle({
        font: {
            color: '#FF0800',
            size: 12
        },
        numberFormat: '$#,##0.00; ($#,##0.00); -',
        alignment: { vertical: 'top'}
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
    ws.cell(1,4).string("status").style(headerStyle);
    ws.cell(1,5).string("direction").style(headerStyle);
    ws.cell(1,6).string("languageId").style(headerStyle);
    ws.cell(1,7).string("text").style(headerStyle);
    ws.row(1).freeze();
    ws.column(1).setWidth(15);
    ws.column(2).setWidth(25);
    ws.column(3).setWidth(20);
    ws.column(4).setWidth(5);
    ws.row(1).filter();

    let row = 2; 
    for(let serviceName in translationMap) {
        let serviceTranslations = translationMap[serviceName];
        for(let componentId in serviceTranslations) {
            let componentTranslations = serviceTranslations[componentId];
            for (let tkey in componentTranslations) {
                ws.cell(row, 1, row+1, 1, true).string(serviceName);
                ws.cell(row, 2, row+1, 2, true).string(componentId);
                ws.cell(row, 3, row+1, 3, true).string(tkey);
                let tstatus = "missing";
                let toValue = componentTranslations[tkey][to];
                if(toValue) tstatus = "translated";

                ws.cell(row, 4, row+1, 4, true).string(tstatus);
                ws.cell(row, 5).string("from");
                ws.cell(row, 6).string(from);
                ws.cell(row, 7).string(componentTranslations[tkey][from]);

                ws.cell(row+1, 5).string("to");
                ws.cell(row+1, 6).string(to);
                if(toValue) ws.cell(row+1, 7).string(toValue);
                row+=2;
            }
        }
    }
    

    let fileName = 'Translations_' + to + '.xlsx';
    wb.write(fileName);
    return Promise.resolve(fileName);
}


