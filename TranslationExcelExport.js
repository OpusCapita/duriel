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
    ws.cell(1,5).string(from).style(headerStyle);
    ws.cell(1,6).string(to).style(headerStyle);
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
                ws.cell(row, 1).string(serviceName);
                ws.cell(row, 2).string(componentId);
                ws.cell(row, 3).string(tkey);
                let tstatus = "missing";
                let toValue = componentTranslations[tkey][to];
                let srcValue = componentTranslations[tkey][from];
                if(toValue && toValue.length > 0)  {
                    tstatus = "translated";
                    ws.cell(row, 6).string(toValue);
                    if(!srcValue) { // dest value, but no src value
                        console.error("dest value but no src value in " + from + " for key " + tkey + " (serviceName = " + serviceName + ", component = " + componentId + ")");
                    }
                    else {
                        ws.cell(row, 5).string(srcValue);
                    }
                }
                else {
                    if(!srcValue) { // neither src nor dest value
                        console.log("no src nor dest value in " + from + " for key " + tkey + " (serviceName = " + serviceName + ", component = " + componentId + ")");
                    }
                    else {
                        ws.cell(row, 5).string(srcValue);
                    }
                }

                ws.cell(row, 4).string(tstatus);

                row+=1;
            }
        }
    }
    

    let fileName = 'Translations_' + to + '.xlsx';
    wb.write(fileName);
    return Promise.resolve(fileName);
}


