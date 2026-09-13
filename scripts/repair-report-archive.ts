import path from 'node:path';
import {repairStreamedReportPackage} from '../shared/archive/reportPackage.ts';

const directory=process.argv[2];
if(!directory)throw new Error('Usage: repair-report-archive.ts <campaign-directory>');
console.log(JSON.stringify(await repairStreamedReportPackage(path.resolve(directory)),null,2));
