const USERS_SHEET = 'Usuários';
const QUOTES_SHEET = 'Orçamentos';
const ITEMS_SHEET = 'Itens do Orçamento';
const PLANNING_SHEET = 'Planejamento';
const COMMISSIONS_SHEET = 'Comissões';
const COMMISSION_HEADERS = ['ID', 'ID orçamento', 'Cliente', 'ID item', 'Produto', 'Quantidade', 'Valor venda unitário', 'Valor Base Unitário', 'Venda total', 'Valor Total Base', 'Lucro', 'Comissão', 'Status', 'Criado em'];
const LEGACY_COMMISSION_HEADERS = ['ID', 'ID orçamento', 'Cliente', 'ID item', 'Produto', 'Quantidade', 'Valor venda unitário', 'Custo-base unitário', 'Venda total', 'Custo total', 'Lucro', 'Comissão', 'Status', 'Criado em'];

function doPost(event) {
  try {
    const request = JSON.parse(event.postData && event.postData.contents || '{}');
    const action = String(request.action || '');
    const payload = request.payload || {};
    if (action === 'login') return json(login(payload));
    if (action === 'logout') return json(logout(request.token));
    requireSession(request.token);
    if (action === 'quotes.list') return json(ok(listQuotes()));
    if (action === 'quotes.save') return json(ok(saveQuote(payload.quote)));
    if (action === 'quotes.delete') return json(ok(deleteQuote(payload.quoteId)));
    if (action === 'plans.list') return json(ok(listPlans()));
    if (action === 'plans.save') return json(ok(savePlan(payload.plan)));
    if (action === 'plans.delete') return json(ok(deletePlan(payload.row)));
    if (action === 'plans.synchronize') return json(ok(synchronizePlans(payload.plans || [])));
    if (action === 'commissions.list') return json(ok(listCommissions()));
    if (action === 'commissions.save') return json(ok(saveCommission(payload.entry)));
    if (action === 'commissions.status') return json(ok(updateCommissionStatus(payload.id, payload.status)));
    if (action === 'commissions.delete') return json(ok(deleteCommission(payload.id)));
    throw appError('BAD_REQUEST', 'Operação inválida.');
  } catch (error) {
    return json({ ok: false, code: error.code || 'ERROR', message: error.message || 'Não foi possível concluir a operação na planilha.' });
  }
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function ok(data) { return { ok: true, data: data }; }
function appError(code, message) { const error = new Error(message); error.code = code; return error; }
function sheet(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name) || (() => { throw appError('ERROR', 'Não encontrei a aba ' + name + '.'); })(); }
function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function activeValue(value) { return String(value || '').trim().toLowerCase() === 'sim'; }

function findUser(email) {
  const users = sheet(USERS_SHEET).getDataRange().getDisplayValues();
  const headers = users.shift() || [];
  const emailIndex = headers.indexOf('Email');
  const passwordIndex = headers.indexOf('Senha');
  const nameIndex = headers.indexOf('Nome');
  const activeIndex = headers.indexOf('Ativo');
  if ([emailIndex, passwordIndex, nameIndex, activeIndex].some(index => index < 0)) throw appError('ERROR', 'A aba Usuários precisa ter as colunas Email, Senha, Nome e Ativo.');
  const row = users.find(values => normalizeEmail(values[emailIndex]) === normalizeEmail(email));
  return row ? { email: normalizeEmail(row[emailIndex]), password: String(row[passwordIndex]), name: String(row[nameIndex]).trim(), active: activeValue(row[activeIndex]) } : null;
}

function sessionKey(token) { return 'session:' + String(token || ''); }
function login(payload) {
  const user = findUser(payload.email);
  if (!user || !user.active || user.password !== String(payload.password || '')) throw appError('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
  const token = Utilities.getUuid() + Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty(sessionKey(token), JSON.stringify({ email: user.email, name: user.name }));
  return ok({ token: token, name: user.name });
}

function requireSession(token) {
  const saved = PropertiesService.getScriptProperties().getProperty(sessionKey(token));
  if (!saved) throw appError('UNAUTHORIZED', 'Sua sessão não é mais válida. Entre novamente.');
  const session = JSON.parse(saved);
  const user = findUser(session.email);
  if (!user || !user.active) {
    PropertiesService.getScriptProperties().deleteProperty(sessionKey(token));
    throw appError('INACTIVE', 'Seu acesso foi desativado.');
  }
  return session;
}

function logout(token) {
  if (token) PropertiesService.getScriptProperties().deleteProperty(sessionKey(token));
  return ok(true);
}

function isoDate(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const text = String(value || '');
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? match[3] + '-' + match[2] + '-' + match[1] : text;
}

function listQuotes() {
  const quoteRows = valuesFrom(QUOTES_SHEET, 2, 13);
  const itemRows = valuesFrom(ITEMS_SHEET, 2, 5);
  return quoteRows.filter(row => row[0]).map((row, index) => ({
    id: row[0], createdAt: row[1], updatedAt: row[2], client: row[3], phone: row[4], status: row[5], validUntil: row[6],
    discount: Number(row[8] || 0), total: Number(row[9] || 0), notes: row[10] || '', receivedAmount: Number(row[11] || 0), deliveryDate: isoDate(row[12]),
    items: itemRows.filter(item => item[0] === row[0]).map((item, itemIndex) => ({ id: 'item-' + (itemIndex + 2), description: item[1] || '', quantity: Number(item[2] || 0), unitPrice: Number(item[3] || 0) })),
    row: index + 2,
  }));
}

function valuesFrom(name, startRow, columns) {
  const current = sheet(name);
  const count = current.getLastRow() - startRow + 1;
  return count > 0 ? current.getRange(startRow, 1, count, columns).getValues() : [];
}

function displayValuesFrom(name, startRow, columns) {
  const current = sheet(name);
  const count = current.getLastRow() - startRow + 1;
  return count > 0 ? current.getRange(startRow, 1, count, columns).getDisplayValues() : [];
}

function saveQuote(quote) {
  if (!quote || !quote.id) throw appError('BAD_REQUEST', 'Orçamento inválido.');
  const quoteSheet = sheet(QUOTES_SHEET);
  const itemSheet = sheet(ITEMS_SHEET);
  const quoteRows = valuesFrom(QUOTES_SHEET, 2, 13);
  const index = quoteRows.findIndex(row => row[0] === quote.id);
  const now = new Date().toISOString();
  const items = (quote.items || []).filter(item => String(item.description || '').trim());
  if (!items.length || items.some(item => !String(item.description || '').trim() || !isFinite(Number(item.quantity)) || Number(item.quantity) <= 0 || !isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 0)) throw appError('BAD_REQUEST', 'Preencha os itens com valores válidos.');
  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  const row = [quote.id, quote.createdAt || now, now, quote.client || '', quote.phone || '', quote.status || 'Rascunho', quote.validUntil || '', subtotal, Number(quote.discount || 0), Math.max(0, subtotal - Number(quote.discount || 0)), quote.notes || '', Number(quote.receivedAmount || 0), quote.deliveryDate || ''];
  const rowNumber = index < 0 ? quoteSheet.getLastRow() + 1 : index + 2;
  quoteSheet.getRange(rowNumber, 1, 1, 13).setValues([row]);
  const currentItems = valuesFrom(ITEMS_SHEET, 2, 5).map((item, itemIndex) => ({ values: item, row: itemIndex + 2 })).filter(item => item.values[0] === quote.id);
  currentItems.sort((a, b) => b.row - a.row).forEach(item => itemSheet.deleteRow(item.row));
  itemSheet.getRange(itemSheet.getLastRow() + 1, 1, items.length, 5).setValues(items.map(item => [quote.id, item.description, Number(item.quantity || 0), Number(item.unitPrice || 0), Number(item.quantity || 0) * Number(item.unitPrice || 0)]));
  return Object.assign({}, quote, { updatedAt: now, total: Math.max(0, subtotal - Number(quote.discount || 0)), items: items });
}

function deleteQuote(quoteId) {
  const quoteRows = valuesFrom(QUOTES_SHEET, 2, 13);
  const quoteIndex = quoteRows.findIndex(row => row[0] === quoteId);
  if (quoteIndex < 0) throw appError('BAD_REQUEST', 'Orçamento não encontrado.');
  valuesFrom(ITEMS_SHEET, 2, 5).map((row, index) => ({ row: index + 2, quoteId: row[0] })).filter(item => item.quoteId === quoteId).sort((a, b) => b.row - a.row).forEach(item => sheet(ITEMS_SHEET).deleteRow(item.row));
  sheet(QUOTES_SHEET).deleteRow(quoteIndex + 2);
  return true;
}

function commissionsSheet() {
  const commissions = sheet(COMMISSIONS_SHEET);
  if (!commissions.getLastRow()) {
    commissions.getRange(1, 1, 1, COMMISSION_HEADERS.length).setValues([COMMISSION_HEADERS]);
    commissions.setFrozenRows(1);
    return commissions;
  }
  const headers = commissions.getRange(1, 1, 1, COMMISSION_HEADERS.length).getDisplayValues()[0];
  if (headers.join('|') !== COMMISSION_HEADERS.join('|') && headers.join('|') !== LEGACY_COMMISSION_HEADERS.join('|')) throw appError('ERROR', 'A aba Comissões precisa ter as colunas: ' + COMMISSION_HEADERS.join(', ') + '.');
  return commissions;
}

function commissionFromRow(row) {
  return { id: String(row[0] || ''), quoteId: String(row[1] || ''), client: String(row[2] || ''), itemId: String(row[3] || ''), itemDescription: String(row[4] || ''), quantity: Number(row[5] || 0), saleUnitPrice: Number(row[6] || 0), baseUnitPrice: Number(row[7] || 0), saleTotal: Number(row[8] || 0), costTotal: Number(row[9] || 0), profit: Number(row[10] || 0), commission: Number(row[11] || 0), status: String(row[12] || 'Não pago'), createdAt: String(row[13] || '') };
}

function listCommissions() {
  const commissions = commissionsSheet();
  const count = commissions.getLastRow() - 1;
  return count > 0 ? commissions.getRange(2, 1, count, COMMISSION_HEADERS.length).getValues().map(commissionFromRow).filter(entry => entry.id) : [];
}

function commissionNumber(value, label) {
  const number = Number(value);
  if (!isFinite(number) || number < 0) throw appError('BAD_REQUEST', label + ' inválido.');
  return number;
}

function saveCommission(entry) {
  if (!entry || !String(entry.id || '').trim() || !String(entry.quoteId || '').trim() || !String(entry.itemId || '').trim()) throw appError('BAD_REQUEST', 'Lançamento de comissão inválido.');
  const quantity = commissionNumber(entry.quantity, 'Quantidade');
  if (quantity <= 0) throw appError('BAD_REQUEST', 'Quantidade inválida.');
  const saleUnitPrice = commissionNumber(entry.saleUnitPrice, 'Valor de venda unitário');
  const baseUnitPrice = commissionNumber(entry.baseUnitPrice, 'Custo-base unitário');
  const saleTotal = quantity * saleUnitPrice;
  const costTotal = quantity * baseUnitPrice;
  const profit = costTotal * .5;
  const commission = profit * .25 + (saleTotal - costTotal) * .5;
  const commissions = commissionsSheet();
  const existing = listCommissions().find(current => current.id === String(entry.id));
  if (existing) throw appError('BAD_REQUEST', 'Este lançamento de comissão já existe.');
  const saved = { id: String(entry.id), quoteId: String(entry.quoteId), client: String(entry.client || ''), itemId: String(entry.itemId), itemDescription: String(entry.itemDescription || ''), quantity: quantity, saleUnitPrice: saleUnitPrice, baseUnitPrice: baseUnitPrice, saleTotal: saleTotal, costTotal: costTotal, profit: profit, commission: commission, status: 'Não pago', createdAt: new Date().toISOString() };
  commissions.appendRow([saved.id, saved.quoteId, saved.client, saved.itemId, saved.itemDescription, saved.quantity, saved.saleUnitPrice, saved.baseUnitPrice, saved.saleTotal, saved.costTotal, saved.profit, saved.commission, saved.status, saved.createdAt]);
  return saved;
}

function updateCommissionStatus(id, status) {
  const normalizedStatus = String(status || '');
  if (!['Não pago', 'Pago'].includes(normalizedStatus)) throw appError('BAD_REQUEST', 'Status de comissão inválido.');
  const commissions = commissionsSheet();
  const entries = listCommissions();
  const index = entries.findIndex(entry => entry.id === String(id || ''));
  if (index < 0) throw appError('BAD_REQUEST', 'Lançamento de comissão não encontrado.');
  commissions.getRange(index + 2, 13).setValue(normalizedStatus);
  return Object.assign({}, entries[index], { status: normalizedStatus });
}

function deleteCommission(id) {
  const commissions = commissionsSheet();
  const index = listCommissions().findIndex(entry => entry.id === String(id || ''));
  if (index < 0) throw appError('BAD_REQUEST', 'Lançamento de comissão não encontrado.');
  commissions.deleteRow(index + 2);
  return true;
}

function listPlans() {
  return displayValuesFrom(PLANNING_SHEET, 5, 15).map((row, index) => planFromRow(row, index + 5)).filter(plan => plan.order || plan.piece);
}

function printerName(value) {
  const name = String(value || '').trim();
  if (name === 'Bambu A1') return 'Osvalda';
  if (name === 'Bambu A1 2') return 'Claudinho';
  return name || 'Osvalda';
}

function planFromRow(row, sheetRow) {
  return { row: sheetRow, order: row[0] || '', piece: row[1] || '', quantity: Number(row[2] || 1), details: row[3] || '', hours: Number(row[4] || 0), minutes: Number(row[5] || 0), pause: Number(row[6] || 0), start: row[7] || '', end: row[8] || '', duration: row[9] || '', status: row[10] || 'Planejado', pauseDuring: Number(row[11] || 0), occurrence: row[12] || '', printer: printerName(row[13]), link: row[14] || '' };
}

function planEndFormula(row) { return '=H' + row + '+E' + row + '/24+F' + row + '/1440+L' + row + '/1440'; }
function validPlanRow(row) {
  const number = Number(row);
  if (!Number.isInteger(number) || number < 5 || number > sheet(PLANNING_SHEET).getLastRow()) throw appError('BAD_REQUEST', 'Linha de planejamento inválida.');
  return number;
}
function savePlan(plan) {
  if (!plan) throw appError('BAD_REQUEST', 'Planejamento inválido.');
  const planning = sheet(PLANNING_SHEET);
  const row = plan.row ? validPlanRow(plan.row) : planning.getLastRow() + 1;
  if (!plan.row) {
    planning.insertRowBefore(row);
    const source = row > 5 ? row - 1 : row + 1;
    if (source <= planning.getLastRow()) planning.getRange(source, 9, 1, 2).copyTo(planning.getRange(row, 9, 1, 2), SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
  }
  planning.getRange(row, 1, 1, 8).setValues([[plan.order || '', plan.piece || '', Number(plan.quantity || 1), plan.details || '', Number(plan.hours || 0), Number(plan.minutes || 0), Number(plan.pause || 0), plan.start || '']]);
  planning.getRange(row, 11, 1, 4).setValues([[plan.status || 'Planejado', Number(plan.pauseDuring || 0), plan.occurrence || '', printerName(plan.printer)]]);
  planning.getRange(row, 15).setValue(plan.link || '');
  if (String(plan.status || '').toLowerCase() === 'planejado') planning.getRange(row, 9).setFormula(planEndFormula(row));
  return Object.assign({}, plan, { row: row });
}

function deletePlan(row) { sheet(PLANNING_SHEET).deleteRow(validPlanRow(row)); return true; }
function synchronizePlans(plans) {
  const planning = sheet(PLANNING_SHEET);
  const lastRow = planning.getLastRow();
  const planned = plans.filter(plan => plan.row && String(plan.status || '').toLowerCase() === 'planejado');
  if (!planned.length) return true;

  const changes = new Map();
  planned.forEach(plan => {
    const row = Number(plan.row);
    if (!Number.isInteger(row) || row < 5 || row > lastRow) throw appError('BAD_REQUEST', 'Linha de planejamento inválida.');
    changes.set(row, plan);
  });

  const firstRow = Math.min.apply(null, Array.from(changes.keys()));
  const rowCount = Math.max.apply(null, Array.from(changes.keys())) - firstRow + 1;
  const orders = planning.getRange(firstRow, 1, rowCount, 1).getValues();
  const starts = planning.getRange(firstRow, 8, rowCount, 1).getValues();
  const ends = planning.getRange(firstRow, 9, rowCount, 1).getFormulas();

  changes.forEach((plan, row) => {
    const index = row - firstRow;
    orders[index][0] = plan.order || '';
    starts[index][0] = plan.start || '';
    ends[index][0] = planEndFormula(row);
  });

  planning.getRange(firstRow, 1, rowCount, 1).setValues(orders);
  planning.getRange(firstRow, 8, rowCount, 1).setValues(starts);
  planning.getRange(firstRow, 9, rowCount, 1).setFormulas(ends);
  return true;
}
