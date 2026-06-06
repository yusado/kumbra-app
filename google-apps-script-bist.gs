/**
 * Google Apps Script for BIST Data Endpoint
 *
 * This script reads BIST stock prices from a Google Sheet and returns them as JSON.
 * It can be deployed as a web app to provide a REST API for the Kumbra app.
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Sheet with columns: symbol, name, price, change, changePercent, currency, timestamp, source
 * 2. Use GOOGLEFINANCE function or manual data entry to populate prices
 * 3. Deploy this script as a web app (Publish > Deploy as web app)
 * 4. Set the URL in VITE_BIST_GAS_URL environment variable
 *
 * GOOGLEFINANCE EXAMPLES (in Google Sheet cells):
 * =GOOGLEFINANCE("IST:GARAN", "price")           - Returns current price
 * =GOOGLEFINANCE("IST:GARAN", "change")          - Returns change amount
 * =GOOGLEFINANCE("IST:GARAN", "changepct")       - Returns change percent
 * =GOOGLEFINANCE("BIST100", "price")              - Returns BIST 100 index
 *
 * Sheet structure example:
 * | Symbol  | Name             | Price | Change | Change% | Currency | Timestamp | Source |
 * |---------|------------------|-------|--------|---------|----------|----------|--------|
 * | GARAN   | Garanti Bankası  | 125.5 | 1.2    | 0.96    | TRY      | =NOW()   | GAS    |
 * | THYAO   | Türk Hava Yolları| 295.0 | 3.5    | 1.20    | TRY      | =NOW()   | GAS    |
 */

// Sheet ID - replace with your actual sheet ID
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';
const SHEET_NAME = 'BIST_Prices';

/**
 * Main doGet function - handles HTTP GET requests
 * Usage: ?symbols=GARAN,THYAO,ASELS
 */
function doGet(e) {
  try {
    const symbols = e.parameter.symbols ? e.parameter.symbols.split(',') : null;
    const data = getBISTPrices(symbols);

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      source: 'google-apps-script',
      symbols: data
    };

    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString(),
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle POST requests for triggering sheet refresh
 */
function doPost(e) {
  try {
    // Optionally refresh the sheet data here
    refreshSheetData();
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, message: 'Sheet refreshed' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Read prices from the Google Sheet
 */
function getBISTPrices(requestedSymbols) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error('Sheet not found: ' + SHEET_NAME);
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Find column indices
  const symbolIdx = headers.indexOf('Symbol');
  const nameIdx = headers.indexOf('Name');
  const priceIdx = headers.indexOf('Price');
  const changeIdx = headers.indexOf('Change');
  const changePctIdx = headers.indexOf('Change%');
  const currencyIdx = headers.indexOf('Currency');
  const timestampIdx = headers.indexOf('Timestamp');
  const sourceIdx = headers.indexOf('Source');

  const results = [];

  // Skip header row, process data rows
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const symbol = row[symbolIdx];

    if (!symbol) continue;

    // Filter if specific symbols requested
    if (requestedSymbols && !requestedSymbols.includes(symbol)) continue;

    results.push({
      symbol: symbol,
      name: row[nameIdx] || symbol,
      price: parseFloat(row[priceIdx]) || 0,
      change: parseFloat(row[changeIdx]) || 0,
      changePercent: parseFloat(row[changePctIdx]) || 0,
      currency: row[currencyIdx] || 'TRY',
      timestamp: row[timestampIdx] ? new Date(row[timestampIdx]).toISOString() : new Date().toISOString(),
      source: row[sourceIdx] || 'google-sheets'
    });
  }

  return results;
}

/**
 * Refresh sheet data using GOOGLEFINANCE formulas
 * This function can be triggered by a time-driven trigger
 */
function refreshSheetData() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) return;

  // Update timestamp column for all rows
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const timestampCol = getColumnLetter(sheet, 'Timestamp');
    const timestamps = [];
    for (let i = 2; i <= lastRow; i++) {
      timestamps.push([new Date()]);
    }
    sheet.getRange(timestampCol + '2:' + timestampCol + lastRow).setValues(timestamps);
  }

  // Force GOOGLEFINANCE formulas to recalculate
  SpreadsheetApp.flush();
}

/**
 * Helper to get column letter from header name
 */
function getColumnLetter(sheet, headerName) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idx = headers.indexOf(headerName);
  if (idx === -1) return null;
  return String.fromCharCode(65 + idx); // A, B, C, ...
}

/**
 * Set up automatic refresh trigger
 * Run this once to set up daily refresh
 */
function setupRefreshTrigger() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'refreshSheetData') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new trigger - runs every 15 minutes during market hours
  ScriptApp.newTrigger('refreshSheetData')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('Refresh trigger set up successfully');
}

/**
 * Fetch price using GOOGLEFINANCE (for updating the sheet)
 * Can be called from sheet formulas or scripts
 */
function fetchGoogleFinancePrice(symbol) {
  try {
    // Note: GOOGLEFINANCE is a spreadsheet function, not directly callable from Apps Script
    // Use external API as alternative or embed in sheet formulas
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.IS?interval=1d&range=1d`;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      const meta = data.chart?.result?.[0]?.meta;
      if (meta) {
        return {
          price: meta.regularMarketPrice,
          change: meta.regularMarketPrice - (meta.chartPreviousClose || meta.regularMarketPrice),
          changePercent: ((meta.regularMarketPrice - (meta.chartPreviousClose || meta.regularMarketPrice)) / (meta.chartPreviousClose || 1)) * 100
        };
      }
    }
    return null;
  } catch (e) {
    Logger.log('Error fetching price for ' + symbol + ': ' + e.toString());
    return null;
  }
}

/**
 * Manual price update using Yahoo Finance as backup
 * Call this if GOOGLEFINANCE data is stale
 */
function updatePricesFromYahoo() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const symbolIdx = headers.indexOf('Symbol');
  const priceIdx = headers.indexOf('Price');
  const changeIdx = headers.indexOf('Change');
  const changePctIdx = headers.indexOf('Change%');

  for (let i = 1; i < data.length; i++) {
    const symbol = data[i][symbolIdx];
    if (!symbol) continue;

    const priceData = fetchGoogleFinancePrice(symbol);
    if (priceData) {
      sheet.getRange(i + 1, priceIdx + 1).setValue(priceData.price);
      sheet.getRange(i + 1, changeIdx + 1).setValue(priceData.change);
      sheet.getRange(i + 1, changePctIdx + 1).setValue(priceData.changePercent);
    }

    // Rate limiting
    Utilities.sleep(200);
  }

  SpreadsheetApp.flush();
}

/**
 * Test function - run to verify setup
 */
function testSetup() {
  Logger.log('Testing BIST data fetch...');

  // Test with mock request
  const mockEvent = {
    parameter: { symbols: 'GARAN,THYAO' }
  };

  const result = doGet(mockEvent);
  Logger.log('Result: ' + result.getContent());
}
