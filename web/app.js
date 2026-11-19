const $ = (s, root = document) => root.querySelector(s);
const storage = { get(key) { try { return localStorage.getItem(key); } catch {} }, set(key, value) { try { localStorage.setItem(key, value); } catch {} } };
let lang = storage.get('uranium-language') === 'fr' ? 'fr' : 'en';
const copy = {
  testOnly:['Test only','Mode test'], sandboxMode:['Sandbox','Simulation'], loading:['Loading workspace…','Chargement…'], footer:['No real funds. No exchange or cash-out services.','Pas de fonds réels, de change ni de retrait.'],
  category:['Recipient-first remittances','Le bénéficiaire fixe le montant'], hero1:['Start with what','On commence par'], hero2:['needs to arrive.','ce qu’il faut recevoir.'], intro:['Set a take-home target. Compare the real ingredients of a quote. Know what made it to the wallet—and what didn’t make it to cash.','Fixez le montant net à recevoir. Comparez les éléments des devis. Distinguez ce qui est arrivé au portefeuille de ce qui n’a pas été retiré.'],
  create:['Create a request','Créer une demande'], useExample:['Try an example','Essayer un exemple'], art:['REQUEST → COMPARE → VERIFY','DEMANDER → COMPARER → VÉRIFIER'], requestStep:['01 / YOUR TARGET','01 / VOTRE OBJECTIF'], planner:['What should arrive?','Quel montant doit arriver ?'], plannerHint:['Choose the currencies, amount and payout your recipient needs. Any corridor is welcome.','Choisissez les devises, le montant et le mode de versement. Aucun trajet n’est imposé.'],
  from:['Sender currency','Devise de départ'], to:['Recipient currency','Devise d’arrivée'], origin:['From (optional)','Départ (facultatif)'], destination:['To (optional)','Destination (facultatif)'], amount:['Take-home target','Montant net souhaité'], payout:['Desired payout','Mode de versement souhaité'], noPII:['Use place names only. Anyone with the share link can view the request.','Indiquez seulement des lieux. Toute personne ayant le lien peut consulter la demande.'],
  explain:['How it works','Comment ça marche'], explain1:['Set the amount that should arrive','Définir le montant à recevoir'], explain1Body:['The recipient chooses the target and payout—not just the amount sent.','Le bénéficiaire choisit le montant net et le mode de versement.'], explain2:['Compare like for like','Comparer des offres équivalentes'], explain2Body:['Enter the provider’s rate and fees. Cash, bank, mobile money, and wallet quotes only rank against the same payout type.','Saisissez le taux et les frais du prestataire. Seules les offres du même mode de versement sont classées.'], explain3:['Check what settled','Vérifier le paiement'], explain3Body:['A settled wallet payment does not mean cash was delivered. We show those outcomes separately.','Un paiement reçu au portefeuille ne prouve pas qu’un retrait a eu lieu. Les résultats restent distincts.'],
  newRequest:['New request','Nouvelle demande'], sender:['Sender view','Vue expéditeur'], recipient:['Recipient view','Vue bénéficiaire'], target:['Take-home target','Montant net souhaité'], requestMeta:['Payout target','Mode de versement'], share:['Copy sender link','Copier le lien expéditeur'], openSender:['Open sender view ↗','Ouvrir la vue expéditeur ↗'], privateLink:['Keep your recipient tab or bookmark it privately. Never share the recipient link.','Gardez cet onglet ou ajoutez-le à vos favoris privés. Ne partagez pas le lien bénéficiaire.'],
  wallet:['Bitcoin wallet value','Valeur en portefeuille Bitcoin'], cash:['Cash pickup','Retrait en espèces'], mobile:['Mobile money balance','Solde d’argent mobile'], bank:['Bank deposit','Virement bancaire'],
  compareStep:['02 / QUOTE CHECK','02 / COMPARER'], compare:['Compare the sender’s total','Comparer le total à envoyer'], compareDescription:['Copy the rate and fees from a provider. Use 0 only when a fee is known to be zero. Calculations are estimates, not live prices.','Recopiez le taux et les frais d’un prestataire. Saisissez 0 uniquement si les frais sont nuls. Les résultats sont des estimations, pas des tarifs en direct.'],
  route:['Route','Offre'], routeName:['Provider or route name','Nom du prestataire ou de l’offre'], source:['Source / date (optional)','Source / date (facultatif)'], rate:['Units received per 1','Unités reçues pour 1'], flat:['Fixed sender fee','Frais fixes à l’envoi'], percent:['Sender fee (%)','Frais à l’envoi (%)'], deduction:['Fee deducted at payout','Frais déduits à l’arrivée'], add:['+ Add a quote','+ Ajouter une offre'], remove:['Remove','Retirer'], examples:['Load sample quotes','Charger des exemples'], compareAction:['Calculate totals','Calculer les totaux'], unknown:['Rate or fee missing','Taux ou frais manquants'], mismatch:['Different payout · not ranked','Versement différent · non classé'], lowest:['Lowest entered total','Total saisi le plus bas'], sendCost:['Sender pays','Total expéditeur'], totalFees:['Sender fees','Frais à l’envoi'], exampleWarning:['Illustrative rates only. Replace these with actual provider figures.','Taux fictifs. Remplacez-les par les chiffres réels des prestataires.'], currentQuotes:['Quotes are stored only in this browser.','Les devis restent dans ce navigateur.'],
  settleStep:['03 / WALLET STATUS','03 / ÉTAT DU PAIEMENT'], settlement:['What actually settled?','Quel paiement a été reçu ?'], settleDescription:['A wallet invoice tracks sats, not delivery of your target currency.','Une facture suit les sats, pas le versement dans la devise souhaitée.'], noInvoice:['No wallet invoice yet','Aucune facture de portefeuille'], waiting:['Waiting for wallet payment','En attente de paiement'], invoiceExpired:['Invoice expired','Facture expirée'], paidSandbox:['Paid to sandbox wallet','Reçu dans le portefeuille simulé'], paidTestnet:['Confirmed by Lightning test node','Confirmé par le nœud Lightning de test'],
  sats:['Invoice amount in sats','Montant de la facture en sats'], satsHelp:['Set the sats separately. There is no automatic conversion or exchange rate guarantee.','Définissez les sats séparément. Aucun taux de change ni conversion automatique n’est garanti.'], newInvoice:['Create test invoice','Créer la facture test'], retryInvoice:['Create another invoice','Créer une autre facture'],
  cashNo:['Cash / mobile money / bank payout: not available or verified here.','Espèces, argent mobile ou virement : aucun versement disponible ou vérifié ici.'], senderWait:['The recipient must create the test invoice before you can pay.','Le bénéficiaire doit créer la facture test avant le paiement.'], sandboxInfo:['Switch to the sender view to pay with seeded test sats. No funds leave a Lightning wallet.','Ouvrez la vue expéditeur pour payer en sats fictifs. Aucun fonds ne quitte un portefeuille Lightning.'], senderBalance:['Sender test balance','Solde test expéditeur'], receiverBalance:['Recipient test balance','Solde test bénéficiaire'], sandboxPay:['Pay from sender sandbox','Payer depuis le solde simulé'], currentInvoice:['Test invoice','Facture de test'], copyInvoice:['Copy invoice','Copier la facture'], qr:['Test Lightning invoice QR','Code QR de la facture Lightning de test'], extPay:['Use a separate wallet on the same test network. Never send mainnet funds.','Utilisez un autre portefeuille sur le même réseau de test. N’envoyez jamais de fonds réels.'], refresh:['Check status','Actualiser le statut'], receipt:['Download test receipt','Télécharger le reçu de test'], noCashProof:['Receipt records wallet settlement only, not a cash payout.','Le reçu atteste uniquement de l’état du portefeuille, pas d’un retrait.'],
  request_not_found:['This link is missing or has expired.','Ce lien est introuvable ou a expiré.'], invalid_amount:['Enter a valid positive amount and the correct decimal precision.','Saisissez un montant positif valide avec le bon nombre de décimales.'], invalid_currency:['Select a supported currency.','Choisissez une devise prise en charge.'], invalid_precision:['This currency or field allows fewer decimal places.','Ce champ ou cette devise accepte moins de décimales.'], invalid_input:['Please check the values you entered.','Vérifiez les valeurs saisies.'], invalid_rate:['Enter a rate greater than zero.','Saisissez un taux supérieur à zéro.'], quote_out_of_range:['One calculated total is out of range. Check its rate and fees.','Un total dépasse la limite. Vérifiez son taux et ses frais.'], service_unavailable:['Service unavailable. Try again in a moment.','Service indisponible. Réessayez dans un instant.'], invoice_exists:['An invoice already exists. Refresh the request.','Une facture existe déjà. Actualisez la demande.'], invoice_expired:['This invoice expired. Ask the recipient to make another.','Cette facture a expiré. Demandez-en une autre au bénéficiaire.'], invoice_mismatch:['The invoice changed. Check the status and try again.','La facture a changé. Actualisez le statut et réessayez.'], not_recipient:['Only the private recipient link can create this invoice.','Seul le lien privé du bénéficiaire permet de créer cette facture.'], mode_changed:['This server is now on a different payment network.','Le serveur utilise un autre réseau de paiement.'], rate_limited:['Too many requests. Try again in a minute.','Trop de demandes. Réessayez dans une minute.'], copied:['Copied to clipboard','Copié'], copyBlocked:['Could not copy; use the link directly.','Copie impossible ; utilisez le lien directement.'],
};
const t = key => copy[key]?.[lang === 'fr' ? 1 : 0] ?? key;
const e = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const tr = key => e(t(key));
const locale = () => lang === 'fr' ? 'fr-FR' : 'en';
const num = n => Number(n).toLocaleString(locale());
const money = (minor, code) => {
  const f = new Intl.NumberFormat(locale(), {style:'currency',currency:code,currencyDisplay:'code'});
  return f.format(minor / 10 ** f.resolvedOptions().maximumFractionDigits);
};
const rails = ['cash','mobile','bank','wallet'];
const payoutOpts = value => rails.map(rail => `<option value="${rail}"${rail === value ? ' selected' : ''}>${tr(rail)}</option>`).join('');
const input = (name, label, attrs = '') => `<label>${label}<input name="${name}" ${attrs}></label>`;
const codeList = () => config.currencies.map(c => `<option value="${e(c)}"></option>`).join('');
const slug = /^[A-Za-z0-9_-]{24}$/;
const [rid, token] = location.hash.slice(1).split('.');
const owner = slug.test(token || '') ? token : '';
const requestPage = location.pathname === '/request';
const base = `/requests/${rid}`;
let config, request, homeDraft, routeRows, quotes, sample = false, checking = false, paymentBusy = false, toastTimer;

async function api(path, method = 'GET', body) {
  const headers = { Accept:'application/json', ...(body !== undefined && {'Content-Type':'application/json'}), ...(owner && {'Authorization':`Bearer ${owner}`}) };
  const res = await fetch(`/api${path}`, { method, headers, ...(body !== undefined && {body:JSON.stringify(body)}) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'service_unavailable');
  return res.json();
}

function report(el, error) { if (el) el.textContent = t(copy[error.message] ? error.message : 'service_unavailable'); }
function toast(key) { const el = $('#toast'); clearTimeout(toastTimer); el.textContent = t(key); el.hidden = false; toastTimer = setTimeout(() => { el.hidden = true; }, 2800); }
async function clipboard(str) { try { await navigator.clipboard.writeText(str); toast('copied'); } catch { toast('copyBlocked'); } }

function art() {
  return `<div class="art" aria-hidden="true"><div class="art-label">${tr('art')}</div><svg class="orbit" viewBox="0 0 430 290" fill="none">
    <circle cx="214" cy="147" r="74" stroke="#64805b" stroke-opacity=".65"/><circle cx="214" cy="147" r="113" stroke="#64805b" stroke-opacity=".42"/>
    <path class="dash" d="M-12 200c25-93 99-140 147-124 41 14 30 65 85 66 50 1 77-56 94-61 49-15 101 21 135 72" stroke="#badc84" stroke-width="1.5"/>
    <path d="M214 104v86m-43-43h86" stroke="#6f8a64" stroke-opacity=".8"/><circle cx="214" cy="147" r="30" fill="#d3fb76" stroke="#eefbd0"/>
    <path d="M202 139v11a12 12 0 0 0 24 0v-11m-18 5 6-6 6 6m-6-6v16" stroke="#172317" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>
    <g class="float"><circle cx="92" cy="150" r="24" fill="#243926" stroke="#87b97a"/><text x="92" y="158" text-anchor="middle" fill="#e4f3dc" font-family="sans-serif" font-weight="700" font-size="23">€</text></g>
    <g><circle cx="323" cy="82" r="26" fill="#243926" stroke="#87b97a"/><text x="323" y="90" text-anchor="middle" fill="#e4f3dc" font-family="sans-serif" font-weight="700" font-size="25">₿</text></g>
    <g class="float"><circle cx="320" cy="220" r="23" fill="#243926" stroke="#87b97a"/><text x="320" y="225" text-anchor="middle" fill="#e4f3dc" font-family="monospace" font-weight="700" font-size="14">CFA</text></g>
    <circle cx="148" cy="218" r="5" fill="#d3fb76"/><circle cx="274" cy="192" r="4" fill="#95c488"/><circle cx="180" cy="77" r="4" fill="#95c488"/>
  </svg></div>`;
}

const arrow = '<span class="arrow" aria-hidden="true">→</span>';
function renderHome() {
  const draft = homeDraft || {};
  $('#app').innerHTML = `<section class="hero"><div class="hero-copy"><div class="eyebrow">${tr('category')}</div><h1>${tr('hero1')} <span>${tr('hero2')}</span></h1><p>${tr('intro')}</p><div class="actions"><a class="btn primary" href="#create">${tr('create')}${arrow}</a><button class="btn ghost" type="button" id="example">${tr('useExample')}</button></div></div>${art()}</section>
    <div class="grid"><section class="card" id="create" aria-labelledby="planner"><div class="kicker">${tr('requestStep')}</div><h2 id="planner">${tr('planner')}</h2><p class="caption">${tr('plannerHint')}</p>
    <form id="create-form" class="gap stack"><datalist id="currencies">${codeList()}</datalist>
      <div class="two">${input('from',tr('from'),`list="currencies" maxlength="3" autocomplete="off" required placeholder="EUR" value="${e(draft.from)}"`)}${input('to',tr('to'),`list="currencies" maxlength="3" autocomplete="off" required placeholder="XOF" value="${e(draft.to)}"`)}</div>
      <div class="two">${input('origin',tr('origin'),`maxlength="48" placeholder="Paris" value="${e(draft.origin)}"`)}${input('destination',tr('destination'),`maxlength="48" placeholder="Dakar" value="${e(draft.destination)}"`)}</div>
      <div class="two">${input('target',tr('amount'),`inputmode="decimal" maxlength="15" required placeholder="50000" value="${e(draft.target)}"`)}<label>${tr('payout')}<select name="rail">${payoutOpts(draft.rail || 'cash')}</select></label></div>
      <p class="caption">${tr('noPII')}</p><p class="error" id="create-error" role="alert" hidden></p><div><button class="btn primary" type="submit">${tr('create')}${arrow}</button></div></form></section>
    <aside class="card"><div class="kicker">01 → 03</div><h2>${tr('explain')}</h2><ol class="steps">${[1,2,3].map(n => `<li><div class="step-no">0${n}</div><div><h3>${tr(`explain${n}`)}</h3><p class="caption">${tr(`explain${n}Body`)}</p></div></li>`).join('')}</ol></aside></div>`;
  $('#example').onclick = () => {
    homeDraft = {from:'EUR',to:'XOF',origin:'Paris',destination:'Dakar',target:'50000',rail:'cash'};
    renderHome(); $('#create').scrollIntoView(); $('[name="target"]').focus({preventScroll:true});
  };
  $('#create-form').onsubmit = async ev => {
    ev.preventDefault();
    const form = ev.currentTarget, button = $('button[type="submit"]',form), error = $('#create-error');
    const values = Object.fromEntries(new FormData(form));
    error.hidden = true; button.disabled = true;
    try {
      const result = await api('/requests','POST',{...values,from:values.from.trim().toUpperCase(),to:values.to.trim().toUpperCase()});
      location.assign(`/request#${result.request.id}.${result.owner}`);
    } catch (err) { report(error,err); error.hidden = false; button.disabled = false; }
  };
}

const shareUrl = () => `${location.origin}/request#${request.id}`;
const emptyRow = () => ({name:'',source:'',rail:request.rail,rate:'',senderFee:'',percentFee:'',receiverFee:''});
const isExample = () => request.from === 'EUR' && request.to === 'XOF' && request.rail === 'cash';

function renderRequest() {
  const places = [request.origin || request.from,request.destination || request.to];
  $('#app').innerHTML = `<section class="request-head"><div class="inline"><a class="btn ghost" href="/">← ${tr('newRequest')}</a><span class="role">${tr(owner ? 'recipient' : 'sender')}</span></div><h1>${tr('target')}: <span>${e(money(request.targetMinor,request.to))}</span></h1><p class="request-sub">${e(places[0])} → ${e(places[1])} · ${e(request.from)} → ${e(request.to)} · ${tr(request.rail)}</p>
    ${owner ? `<div class="actions gap"><button class="btn primary" id="share" type="button">${tr('share')}</button><a class="btn" href="${e(shareUrl())}" target="_blank" rel="noopener noreferrer">${tr('openSender')}</a></div><p class="caption gap">${tr('privateLink')}</p>` : ''}</section>
    <div class="grid"><section class="card" aria-labelledby="comp-title"><div class="kicker">${tr('compareStep')}</div><h2 id="comp-title">${tr('compare')}</h2><p class="caption">${tr('compareDescription')}</p>
    <form class="gap stack" id="quote-form"><div class="stack" id="quote-rows"></div><div class="actions"><button class="btn" id="add-quote" type="button">${tr('add')}</button>${isExample() ? `<button class="btn ghost" id="sample" type="button">${tr('examples')}</button>` : ''}</div><p class="note warn" id="sample-warning" ${sample ? '' : 'hidden'}>${tr('exampleWarning')}</p>
    <div><button class="btn primary" type="submit">${tr('compareAction')}${arrow}</button></div><div class="error" id="quote-error" role="alert"></div><div class="stack tight" id="quote-result" aria-live="polite"></div><p class="caption">${tr('currentQuotes')}</p></form></section>
    <section class="card" aria-labelledby="pay-title"><div class="kicker">${tr('settleStep')}</div><h2 id="pay-title">${tr('settlement')}</h2><p class="caption">${tr('settleDescription')}</p><div id="payment" class="stack gap"></div></section></div>`;
  if (owner) $('#share').onclick = () => clipboard(shareUrl());
  renderRows(); renderQuotes(); renderPayment();
  $('#add-quote').onclick = () => { if (routeRows.length < 5) { routeRows.push(emptyRow()); saveRows(); renderRows(); const rows = document.querySelectorAll('fieldset.route'); $('[name="name"]',rows[rows.length-1]).focus(); } };
  if (isExample()) $('#sample').onclick = () => {
    routeRows = [
      {name:lang === 'fr' ? 'Exemple A · Espèces' : 'Example A · Cash',source:'',rail:'cash',rate:'638',senderFee:'1.5',percentFee:'0',receiverFee:'250'},
      {name:lang === 'fr' ? 'Exemple B · Espèces' : 'Example B · Cash',source:'',rail:'cash',rate:'650',senderFee:'1',percentFee:'1',receiverFee:'0'},
      {name:lang === 'fr' ? 'Exemple C · Portefeuille' : 'Example C · Wallet',source:'',rail:'wallet',rate:'655',senderFee:'0',percentFee:'0',receiverFee:'0'}
    ];
    sample = true; $('#sample-warning').hidden = false; saveRows(); renderRows(); calculate();
  };
  $('#quote-form').onsubmit = ev => { ev.preventDefault(); calculate(); };
}

function renderRows() {
  $('#quote-rows').innerHTML = routeRows.map((row,i) => {
    const field = (key,label,attr='') => input(key,label,`value="${e(row[key])}" ${attr}`);
    return `<fieldset class="route stack tight" data-row="${i}"><legend>${tr('route')} ${i+1}</legend><div class="two">
      ${field('name',tr('routeName'),'maxlength="40"')}<label>${tr('payout')}<select name="rail">${payoutOpts(row.rail)}</select></label></div>
      <div class="two">${field('rate',`${tr('rate')} ${e(request.from)}`, 'inputmode="decimal" maxlength="18"')}${field('source',tr('source'),'maxlength="80"')}</div><div class="three">
      ${field('senderFee',`${tr('flat')} (${e(request.from)})`,'inputmode="decimal" maxlength="15"')}${field('percentFee',tr('percent'),'inputmode="decimal" maxlength="6"')}${field('receiverFee',`${tr('deduction')} (${e(request.to)})`,'inputmode="decimal" maxlength="15"')}</div>
      ${routeRows.length > 1 ? `<div><button class="btn ghost remove" type="button">${tr('remove')}</button></div>`:''}</fieldset>`;
  }).join('');
  document.querySelectorAll('[data-row]').forEach(set => {
    const i = Number(set.dataset.row);
    set.oninput = ev => { if (ev.target.name) { routeRows[i][ev.target.name] = ev.target.value; saveRows(); } };
    const remove = $('.remove',set);
    if(remove) remove.onclick = () => { routeRows.splice(i,1); saveRows(); renderRows(); $('#add-quote').focus(); };
  });
  $('#add-quote').disabled = routeRows.length >= 5;
}

let quoteGeneration = 0;
function saveRows() { storage.set(`uranium-quotes-${rid}`,JSON.stringify({rows:routeRows,sample})); quotes = null; quoteGeneration++; renderQuotes(); }

async function calculate() {
  const generation = ++quoteGeneration;
  const error = $('#quote-error'); error.textContent = '';
  try {
    const result = await api(`${base}/compare`,'POST',{routes:routeRows});
    if (generation === quoteGeneration) { quotes = result; renderQuotes(); }
  } catch (err) { if (generation === quoteGeneration) { quotes = null; renderQuotes(); report(error,err); } }
}

function renderQuotes() {
  const el = $('#quote-result'); if (!el) return;
  el.innerHTML = (quotes?.rows || []).slice().sort((a,b) => (a.requiredMinor ?? Infinity) - (b.requiredMinor ?? Infinity)).map(row => {
    const best = row.requiredMinor != null && row.requiredMinor === quotes.lowestMinor;
    return `<div class="quote-result ${best ? 'best' : ''}"><div><b>${e(routeRows[row.index]?.name?.trim() || `${t('route')} ${row.index+1}`)}</b><div class="caption">${best ? `${tr('lowest')} · ` : ''}${tr(row.rail)}${row.source ? ` · ${e(row.source)}` : ''}</div>${row.requiredMinor != null ? `<div class="caption">${tr('totalFees')}: ${e(money(row.senderFeeMinor,request.from))}</div>` : ''}</div>
    ${row.requiredMinor != null ? `<div><div class="caption">${tr('sendCost')}</div><strong>${e(money(row.requiredMinor,request.from))}</strong></div>` : `<div class="caption">${tr(row.reason === 'payout_mismatch' ? 'mismatch' : 'unknown')}</div>`}</div>`;
  }).join('');
}

function renderPayment() {
  const {state,invoice,settlement,sandboxBalances,mode} = request;
  const root = $('#payment');
  const status = state === 'paid_wallet' ? (mode === 'sandbox' ? 'paidSandbox' : 'paidTestnet') : ({no_invoice:'noInvoice', waiting:'waiting', invoice_expired:'invoiceExpired'})[state];
  const klass = ({no_invoice:'empty',paid_wallet:'paid',invoice_expired:'expired'})[state] || '';
  root.innerHTML = `<div class="status ${klass}" role="status"><i></i>${tr(status)}</div><div class="note">${tr('cashNo')}</div>
    ${sandboxBalances ? `<div class="balance-pair">${[['senderBalance',sandboxBalances.senderSat],['receiverBalance',sandboxBalances.recipientSat]].map(([k,v]) => `<div class="balance"><span class="caption">${tr(k)}</span><strong>${e(num(v))} sats</strong></div>`).join('')}</div>` : ''}
    ${owner && ['no_invoice','invoice_expired'].includes(state) ? `<form class="stack tight" id="invoice-form">${input('sats',tr('sats'),'type="number" min="1" max="2000000" step="1" placeholder="1000" required')}<p class="caption">${tr('satsHelp')}</p><div><button class="btn primary" type="submit">${tr(state === 'no_invoice' ? 'newInvoice' : 'retryInvoice')}</button></div></form>` : ''}
    ${!owner && state === 'no_invoice' ? `<p class="caption">${tr('senderWait')}</p>` : ''}
    ${state === 'waiting' ? `<div><strong>${e(num(invoice.amountSat))} sats</strong> <span class="caption">· ${e(new Date(invoice.expiresAt).toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'}))}</span></div>
    ${mode === 'sandbox' ? (owner ? `<p class="caption">${tr('sandboxInfo')}</p>` : `<div><button class="btn primary" type="button" id="sandbox-pay">${tr('sandboxPay')}${arrow}</button></div>`) :
      `<img class="qr" src="/api${base}/qr" alt="${tr('qr')}" width="248" height="248"><label>${tr('currentInvoice')}<input value="${e(invoice.paymentRequest)}" readonly></label><div><button class="btn" type="button" id="copy-invoice">${tr('copyInvoice')}</button></div><p class="caption">${tr('extPay')}</p>`}` : ''}
    ${settlement ? `<div class="receipt"><strong>${e(num(settlement.amountSat))} sats</strong> <span class="caption">· ${e(new Date(settlement.settledAt).toLocaleString(locale()))}</span><p class="caption">${tr('noCashProof')}</p></div><div><button class="btn" type="button" id="receipt">${tr('receipt')}</button></div>` : ''}
    <div class="actions">${settlement ? '' : `<button class="btn ghost" type="button" id="refresh">${tr('refresh')}</button>`}</div><div class="error" id="pay-error" role="alert"></div>`;
  const form = $('#invoice-form');
  if (form) form.onsubmit = ev => { ev.preventDefault(); changePayment($('button',form),'invoice',{amountSat:Number(form.elements.sats.value)}); };
  if ($('#sandbox-pay')) $('#sandbox-pay').onclick = ev => changePayment(ev.currentTarget,'sandbox-pay',{paymentHash:invoice.paymentHash});
  if ($('#refresh')) $('#refresh').onclick = () => refreshPayment(true);
  if ($('#copy-invoice')) $('#copy-invoice').onclick = () => clipboard(invoice.paymentRequest);
  if ($('#receipt')) $('#receipt').onclick = () => {
    const text = {version:1,requestId:request.id,targetCurrency:request.to,targetMinor:request.targetMinor,desiredPayout:request.rail,
      walletSettlement:settlement,cashPayoutVerified:false,statement:'Test-only wallet settlement record; not proof of cash payout.'};
    const url = URL.createObjectURL(new Blob([JSON.stringify(text,null,2)],{type:'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = 'uranium-transfer-test-receipt.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
}

async function refreshPayment(visible = false) {
  if (!request || checking || paymentBusy || request.settlement) return;
  checking = true;
  try {
    const next = request.mode === 'testnet' && request.invoice ? await api(`${base}/refresh`,'POST') : await api(base);
    if (paymentBusy || (request.settlement && !next.settlement) || (request.invoice && !next.invoice)) return;
    const changed = next.state !== request.state || next.invoice?.paymentHash !== request.invoice?.paymentHash;
    request = next;
    if (changed) renderPayment();
  } catch (error) { if (visible) report($('#pay-error'),error); }
  finally { checking = false; }
}

async function changePayment(button, action, body) {
  if (paymentBusy) return;
  paymentBusy = true; button.disabled = true; $('#pay-error').textContent = '';
  try { request = await api(`${base}/${action}`,'POST',body); renderPayment(); }
  catch (error) { report($('#pay-error'),error); }
  finally { paymentBusy = false; button.disabled = false; }
}

function chrome() {
  document.documentElement.lang = lang;
  for (const item of document.querySelectorAll('[data-t]')) item.textContent = t(item.dataset.t);
  for (const btn of document.querySelectorAll('[data-lang]')) btn.setAttribute('aria-pressed',btn.dataset.lang === lang);
  if (config) $('#mode-label').textContent = config.mode === 'sandbox' ? t('sandboxMode') : config.network || t('testOnly');
}

function missing(error) {
  $('#app').innerHTML = `<section class="missing"><h1>${tr(error)}</h1><div class="gap"><a class="btn" href="/">${tr('newRequest')}</a></div></section>`;
}

document.querySelectorAll('[data-lang]').forEach(btn => btn.onclick = () => {
  if (lang === btn.dataset.lang) return;
  if ($('#create-form')) homeDraft = Object.fromEntries(new FormData($('#create-form')));
  lang = btn.dataset.lang; storage.set('uranium-language',lang); chrome();
  if (request) renderRequest(); else if (requestPage) missing('request_not_found'); else if (config) renderHome();
});
if (requestPage) window.addEventListener('hashchange',() => location.reload());

(async () => {
  chrome();
  try {
    config = await api('/config');
    chrome();
    if (!requestPage) return renderHome();
    if (!slug.test(rid) || (token && !owner)) return missing('request_not_found');
    request = await api(base);
    let saved; try { saved = JSON.parse(storage.get(`uranium-quotes-${rid}`)); } catch {}
    routeRows = Array.isArray(saved?.rows) && saved.rows.length > 0 && saved.rows.length <= 5 ? saved.rows : [emptyRow()];
    sample = saved?.sample === true;
    renderRequest(); refreshPayment();
    setInterval(() => { if (!document.hidden) refreshPayment(); }, 5000);
    document.addEventListener('visibilitychange',() => { if (!document.hidden) refreshPayment(); });
  } catch (error) { missing(copy[error.message] ? error.message : 'service_unavailable'); }
  finally { $('#app').removeAttribute('aria-busy'); }
})();
