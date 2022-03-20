require('dotenv-extended/config');
const cmd = require('node-cmd');
const { join } = require('path');
const { readdir, readFile } = require('fs').promises;
const { difference, isEmpty, last } = require('lodash');
const ExcelJS = require('exceljs');

const ignoreDirs = ['.git', '.devcontainer', '.husky', '.vs', 'node_modules'];

const { INPUTPATH, OUTPATH, CREATOR, OUTPUTFILENAME } = process.env;

const pathsWithPackageJson = [];

const main = async () => {
    try {
        await recursiveFilesScan(INPUTPATH);

        const licenseScansPromise = []
        for (let dir of pathsWithPackageJson) {
            licenseScansPromise.push(licenseScan(dir));
        }

        await Promise.all(licenseScansPromise);

        await buildExcel();
    } catch (exception) {
        console.error(exception);
    }
}

const recursiveFilesScan = async (path) => {
    const dirents = await readdir(path, { withFileTypes: true });
    const files = dirents.filter(direnet => !direnet.isDirectory());

    packageJsonFile = files.filter(file => file.name === 'package.json');

    if (!isEmpty(packageJsonFile)) {
        pathsWithPackageJson.push(path);
    }
    const dirs = dirents.filter(direnet => direnet.isDirectory()).map(direnet => direnet.name);
    const filteredDirs = difference(dirs, ignoreDirs);

    for (let dir of filteredDirs) {
        await recursiveFilesScan(join(path, dir));
    }
}

const licenseScan = async (path) => {
    //path .split get dir name
    const csvFileName = last(path.split('\\'));


    console.log(`working on license: ${csvFileName} at path: ${path}`)

    //CMD license-checker (this creates the CSV file for each package.json file found)
    cmd.runSync(`license-checker --start ${path} --csv --out ${join(OUTPATH, `${csvFileName}.csv`)}`)
}

const buildExcel = async () => {
    console.log(`Creating single xlsx file out of all the files found`);

    const dirents = await readdir(OUTPATH, { withFileTypes: true });
    const files = dirents.filter(direnet => !direnet.isDirectory() && direnet.name.endsWith('csv'));
    const CSVFiles = [];

    for (let file of files) {
        const csv = await readFile(join(OUTPATH, file.name), 'utf8');
        CSVFiles.push({
            spreadSheetName: file.name.replace(/\.[^/.]+$/, ""),
            data: csv
        });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = CREATOR;
    workbook.created = new Date();

    for (let csvFile of CSVFiles) {
        const spreadSheet = workbook.addWorksheet(csvFile.spreadSheetName)
        const rows = csvFile.data.split('\n').map(row => row.replaceAll('"', '').split(','));

        spreadSheet.addRows(rows);
    }

    await workbook.xlsx.writeFile(join(OUTPATH, `${OUTPUTFILENAME}.xlsx`));
}

(async () => await main())();