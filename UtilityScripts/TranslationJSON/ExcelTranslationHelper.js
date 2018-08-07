/**
 * @module
 */
const xl = require('excel4node');
const fs = require("fs");
const path = require('path');
const util = require("util");
const fileExists = util.promisify(fs.access);
const excel = require('exceljs');

module.exports.importFromExcel = importFromExcel;
module.exports.exportToExcel = exportToExcel;


async function importFromExcel(directory, supportedLanguages, allTranslations) {
    // get all local Translations_$languageId.xlsx files
    return fileExists(directory)
    .then( (exists) => {
        console.log("found dir " + directory);
        return Promise.resolve();
    })
    .catch( (err) => {
        console.log("dir not found: ", directory, err);
        process.exit(1);
    })
    .then( async ( ) => {
        var files=fs.readdirSync(directory);
        for(var i=0;i<files.length;i++){
//            console.log("traversing " + filename);
            var filename=path.join(directory,files[i]);
            var stat = fs.lstatSync(filename);
            if (!stat.isDirectory() && filename.endsWith(".xlsx") && files[i].startsWith("Translations_")) {
//                console.log("reading file " + filename);
                let languageId = files[i].substring(13, files[i].length-5);
//                console.log("languageId = " + languageId);
                await importExcelFile(filename, languageId, allTranslations);
            }
        }
        return Promise.resolve(allTranslations);
    });
}

async function importExcelFile(filename, languageId, allTranslations) {
    console.log("importing Excel file: " + filename);
    let workbook = new excel.Workbook();
    await workbook.xlsx.readFile(filename);
    let worksheet = await workbook.getWorksheet(1);
    let serviceName = "";
    let serviceTranslations = {};
    let componentId = "";
    let componentTranslation = {};
    worksheet.eachRow(function(row, rowNumber) {
        //console.log("row=", row.values);
        if (rowNumber < 2) return; // skip header row
//        if(rowNumber %10 == 0) { console.log("processing row " + rowNumber); }
        if(row.values[1] != serviceName) {
//            console.log("updating serviceName from " + serviceName + " to " + row.values[1]);
            serviceName = row.values[1];
            serviceTranslations = allTranslations[serviceName];
            if(!serviceTranslations) serviceTranslations = allTranslations[serviceName] = {};
        }
        if(row.values[2] != componentId) {
//            console.log("updating componentId from " + componentId + " to " + row.values[2]);
            componentId = row.values[2];
            componentTranslations = serviceTranslations[componentId];
            if(!componentTranslations) componentTranslations = serviceTranslations[componentId] = {};
        }
        let key = row.values[3];
        keyTranslations = componentTranslations[key];
        if(!keyTranslations) keyTranslations = componentTranslations[key] = {};
        let translatedValue = row.values[6];
        if(translatedValue) {
          keyTranslations[languageId] = translatedValue;
          if(translatedValue.result) keyTranslations[languageId] = translatedValue.result;
        }
//        console.log('Row ' + rowNumber + ' = ' + JSON.stringify(row.values));
    });
    console.log("worksheet parsed");
    return Promise.resolve(allTranslations);
}


async function exportToExcel(translationMap, from, to) {

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
    wb.write(fileName, function (err, stats) {
	if (err) {
		console.error(err);
	}
        else {
            console.log(stats); // Prints out an instance of a node.js fs.Stats object
        }
    });
    return Promise.resolve(fileName);
}


