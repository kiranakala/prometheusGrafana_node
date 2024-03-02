const express = require('express');
const client = require('prom-client');
const bodyParser = require('body-parser');

const app = express();
const register = new client.Registry();

client.collectDefaultMetrics({ register });

// Set up a map to store multiple meters

// Middleware to parse JSON bodies
// app.use(bodyParser.json());
app.use(express.json())

const meters = {};

// POST endpoint to receive meter readings
app.post('/meterreading', (req, res) => {
  const { meterName, reading, timestamp } = req.body;
 
  if (!meterName || reading === undefined || !timestamp) {
    return res.status(400).send('Missing required fields: meterName, reading, timestamp');
  }
 
  // Create or update the gauge for the specific meter
  if (!meters[meterName]) {
    meters[meterName] = new client.Gauge({
      name: `meter_reading_${meterName}`,
      help: `Energy meter reading for ${meterName} in kWh`,
      labelNames: ['timestamp'],
    });
    register.registerMetric(meters[meterName]);
  }
 
  meters[meterName].set({ timestamp: timestamp.toString() }, reading);
  console.log(meters);
  res.send('Reading recorded');
});

// Set up an object to store building meters
const buildingMeterReadings = {};

app.post('/building/meterreading', (req, res) => {
  const { building, meterName, reading, timestamp } = req.body;
 
  if (!building || !meterName || reading === undefined || !timestamp) {
    return res.status(400).send('Missing required fields: building, meterName, reading, timestamp');
  }
 
  // Create or update the gauge for the specific meter
  if (!buildingMeterReadings[building]) {
    buildingMeterReadings[building] = new client.Gauge({
      name: `${building}_meter_reading`,
      help: `Energy meter reading for ${building} - ${meterName} in kWh`,
      labelNames: ['timestamp'],
    });
    register.registerMetric(buildingMeterReadings[building]);
  }
 
  buildingMeterReadings[building].set({ timestamp: timestamp.toString() }, reading);
  console.log(buildingMeterReadings);
  res.send('Reading recorded');
});


// Gauge for tank level
const tankLevel = new client.Gauge({
  name: 'tank_level',
  help: 'Current level of the tank',
  labelNames: ['tankName', 'date'],
});
register.registerMetric(tankLevel);

// POST endpoint to receive tank level readings
app.post('/tanklevel', (req, res) => {
  const { tankName, level, date } = req.body;

  if (!tankName || level === undefined || !date) {
    return res.status(400).send('Missing required fields: tankName, level, date');
  }

  tankLevel.labels(tankName, date).set(level);
  res.send('Tank level recorded');
});


const previousLevels = {};

const tankVolume = new client.Gauge({
  name: 'tank_volume',
  help: 'Volume of liquid in the tank',
  labelNames: ['tankName', 'date'],
});
register.registerMetric(tankVolume);

const addedConsumptionGauge = new client.Gauge({
  name: 'tank_added_consumption',
  help: 'Added consumption of liquid in the tank',
  labelNames: ['tankName', 'date'],
});
register.registerMetric(addedConsumptionGauge);

app.post('/tankvolume', (req, res) => {
  const { tankName, diameter, level, date } = req.body;

  if (!tankName || diameter === undefined || level === undefined || !date) {
    return res.status(400).send('Missing required fields: tankName, diameter, level, date');
  }

  const radius = diameter / 2;
  const volume = Math.PI * Math.pow(radius, 2) * level;
  let addedConsumption = 0;
  if (previousLevels[tankName] !== undefined) {
    const previousVolume = Math.PI * Math.pow(radius, 2) * previousLevels[tankName];
    addedConsumption = volume - previousVolume;
  }
  previousLevels[tankName] = level;

  tankVolume.labels(tankName, date).set(volume);
  
  addedConsumptionGauge.labels(tankName, date).set(addedConsumption);

  res.send('Tank volume and added consumption recorded');



});

const meterReadingsCounter = new client.Counter({
  name: 'meter_readings_total',
  help: 'Total number of meter readings received',
});

const htPanelMeters = new Map();

app.post('/htPanelMeterReading', (req, res) => {
      const { meterName, previousReading, presentReading, multiplyingFactor, timestamp } = req.body;
    
      if (!meterName || previousReading === undefined || presentReading === undefined || multiplyingFactor === undefined || !timestamp) {
        return res.status(400).send('Missing required fields: meterName, previousReading, presentReading, multiplyingFactor, timestamp');
      }
    
      // Create or update the gauge for the specific meter
      let meterGauge = htPanelMeters.get(meterName);
      if (!meterGauge) {
        meterGauge = new client.Gauge({
          name: `ht_panel_meter_reading_${meterName}`,
          help: `ht panel meter reading for ${meterName} in kWh`,
          labelNames: ['timestamp'],
        });
        htPanelMeters.set(meterName, meterGauge);
        register.registerMetric(meterGauge);
      }
    
      meterGauge.set({ timestamp }, presentReading - previousReading);
      meterReadingsCounter.inc();
      res.send('Reading recorded');
  });

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

const port = 8000;
app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);
});

module.exports = app;
