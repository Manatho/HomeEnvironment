const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
const colors = require('./colors');

let client = require('mongodb').MongoClient;
let url = "mongodb://localhost:27017/"

const fs = require('fs');

let i = 0;
if (!fs.existsSync('./data')){
    fs.mkdirSync('./data');
}
else {
    let files = fs.readdirSync('./data');
    files.forEach(file => {
        if (file.includes('sensorlog')) i++;
    });
}

let currentLog = 'data/sensorlog' + i + '.csv';
const stream = fs.createWriteStream(currentLog, { flags: 'a' });
stream.write('time,ambient(lux),red(lux),green(lux),blue(lux),temperature(C),humidity(%),pressure(hPa)\n');

let availablePorts = [];
let serialport;
let parser;

SerialPort.list((err, ports) => {
	availablePorts = ports;
	console.log('Ports available:');
	ports.forEach((port, i) => {
		console.log(colors.FgCyan, i, colors.Reset, ':', port.comName, port.pnpId, port.serialNumber, port.manufacturer);
	});
	console.log('');

	if (ports.length > 0) selectPort();
	else close('No ports available, closing..');
});

function selectPort() {
	console.log('Select port:', colors.FgCyan);

	process.stdin.resume();
	process.stdin.on('data', d => {
		let selectedPort = parseInt(d.toString());
		if (!isNaN(selectedPort) && selectedPort < availablePorts.length) {
			console.log(colors.Reset + '\nSelected port: ' + availablePorts[selectedPort].comName);
			process.stdin.pause();
			runWithPort(availablePorts[selectedPort]);
		} else {
			console.log(colors.Reset, `Invalid port, please select a valid port: 0-${availablePorts.length - 1}`);
		}
	});
}

function runWithPort(port) {
	console.log('Logging to file: ' + stream.path);
	serialport = new SerialPort(port.comName);
	parser = serialport.pipe(new Readline());
	parser.on('data', dataHandle);
	parser.on('error', console.log);
}

function dataHandle(data) {
	let dataParts = data.split(',');

	if (dataParts.length > 1) {
		let date = new Date().toISOString();
		let ambient = dataParts[0].trim();
		let red = dataParts[1].trim();
		let green = dataParts[2].trim();
		let blue = dataParts[3].trim();
		let temp = dataParts[4] / 100;
		let humidity = dataParts[5] / 100;
		let pressure = dataParts[6];
        stream.write(`${date}, ${ambient}, ${red}, ${green},${blue}, ${temp}, ${humidity}, ${pressure}`);

        MongoClient.connect(url, (err, db) => {
            if(err) throw err;
            let dbo = db.db("home");
            let values = {
                time: date,
                ambientLight: ambient,
                redLight: red,
                greenLight: green,
                blueLight: blue,
                temperature: temp,
                humidity: humidity,
                pressure: pressure
            }
            dbo.collection("sensors").insertOne(values, (err, res) => {
                if(err) throw err;
                db.close();
            })
        })

	}
}

function close(message) {
	console.log(message);
	process.exit(0);
}
