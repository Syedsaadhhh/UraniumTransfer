param(
  [Parameter(Mandatory=$true)][string]$BitcoinBin,
  [Parameter(Mandatory=$true)][string]$LndBin
)

# Local test only. Requires Windows Bitcoin Core 28.1 and LND 0.18.5-beta (matching lncli).
# Creates disposable, isolated nodes, opens one channel, and pays one app-created invoice.
$ErrorActionPreference='Stop'
$temp=[System.IO.Path]::GetTempPath()
if (Test-Path (Join-Path $temp 'opencode')) { $temp=Join-Path $temp 'opencode' }
$root=Join-Path $temp ('uranium-regtest-'+[Guid]::NewGuid().ToString('N'))
$core=Join-Path $root 'core'
$alice=Join-Path $root 'alice'
$bob=Join-Path $root 'bob'
$work=@($core,$alice,$bob)
New-Item -ItemType Directory -Path $work | Out-Null
$password=[Guid]::NewGuid().ToString('N')
$btcflags=@('-regtest',"-datadir=$core",'-rpcport=18465','-rpcuser=fixture',"-rpcpassword=$password")
$nodes=@()
$passed=$false
$project=Split-Path -Parent $PSScriptRoot

function Run([string]$exe, [string[]]$argv) {
  $ErrorActionPreference='Continue'
  $out=& $exe @argv 2>&1
  if ($LASTEXITCODE -ne 0) { throw "Command failed: $(Split-Path -Leaf $exe) exit code $LASTEXITCODE" }
  return ($out -join "`n")
}
function Bitcoin([string[]]$argv) { Run (Join-Path $BitcoinBin 'bitcoin-cli.exe') ($btcflags+$argv) }
function Ln([string]$datadir, [int]$port, [string[]]$argv) {
  Run (Join-Path $LndBin 'lncli.exe') (@('--network=regtest',"--lnddir=$datadir","--rpcserver=127.0.0.1:$port")+$argv)
}
function Until([scriptblock]$condition, [string]$what) {
  $end=[DateTime]::UtcNow.AddSeconds(90)
  do {
    try { if (& $condition) { return } } catch {}
    Start-Sleep -Milliseconds 700
  } while ([DateTime]::UtcNow -lt $end)
  throw "Timed out waiting for $what. Logs: $root"
}

try {
  $nodes+=Start-Process -FilePath (Join-Path $BitcoinBin 'bitcoind.exe') -ArgumentList ($btcflags+@('-port=18466','-listen=0','-txindex=1','-fallbackfee=0.0002','-zmqpubrawblock=tcp://127.0.0.1:29332','-zmqpubrawtx=tcp://127.0.0.1:29333')) -PassThru -WindowStyle Hidden
  Until { try { $null=Bitcoin @('getblockcount'); $true } catch { $false } } 'Bitcoin Core'
  $null=Bitcoin @('createwallet','fixture')
  $mining=Bitcoin @('getnewaddress')
  $null=Bitcoin @('generatetoaddress','101',$mining)

  $common=@('--bitcoin.active','--bitcoin.regtest','--bitcoin.node=bitcoind','--bitcoind.rpchost=127.0.0.1:18465','--bitcoind.rpcuser=fixture',"--bitcoind.rpcpass=$password",'--bitcoind.zmqpubrawblock=tcp://127.0.0.1:29332','--bitcoind.zmqpubrawtx=tcp://127.0.0.1:29333','--noseedbackup','--tlsextradomain=localhost')
  $nodes+=Start-Process -FilePath (Join-Path $LndBin 'lnd.exe') -ArgumentList ($common+@("--lnddir=$alice",'--rpclisten=127.0.0.1:11009','--restlisten=127.0.0.1:18081','--listen=127.0.0.1:19735')) -PassThru -WindowStyle Hidden
  $nodes+=Start-Process -FilePath (Join-Path $LndBin 'lnd.exe') -ArgumentList ($common+@("--lnddir=$bob",'--rpclisten=127.0.0.1:11010','--restlisten=127.0.0.1:18082','--listen=127.0.0.1:19736')) -PassThru -WindowStyle Hidden
  Until { try { $null=Ln $alice 11009 @('getinfo'); $null=Ln $bob 11010 @('getinfo'); $true } catch { $false } } 'both LND nodes'
  $recipient=(Ln $alice 11009 @('getinfo') | ConvertFrom-Json).identity_pubkey
  $funding=(Ln $bob 11010 @('newaddress','p2wkh') | ConvertFrom-Json).address
  $null=Bitcoin @('sendtoaddress',$funding,'0.025')
  $null=Bitcoin @('generatetoaddress','6',$mining)
  Until { [long](Ln $bob 11010 @('walletbalance') | ConvertFrom-Json).confirmed_balance -ge 2000000 } 'payer funds'
  Until {
    $peers=(Ln $bob 11010 @('listpeers') | ConvertFrom-Json).peers
    if ($peers.pub_key -contains $recipient) { $true }
    else { $null=Ln $bob 11010 @('connect', "$recipient@127.0.0.1:19735"); $true }
  } 'payer connection to recipient'
  $null=Ln $bob 11010 @('openchannel',"--node_key=$recipient",'--local_amt=1000000','--sat_per_vbyte=2')
  Until { [int](Bitcoin @('getmempoolinfo') | ConvertFrom-Json).size -ge 1 } 'channel funding transaction'
  $null=Bitcoin @('generatetoaddress','6',$mining)
  Until { [int](Ln $bob 11010 @('getinfo') | ConvertFrom-Json).num_active_channels -ge 1 } 'active channel'

  $credential=Join-Path $alice 'app-invoice.macaroon'
  $null=Ln $alice 11009 @('bakemacaroon',"--save_to=$credential",'uri:/lnrpc.Lightning/GetInfo','uri:/lnrpc.Lightning/AddInvoice','uri:/lnrpc.Lightning/LookupInvoice')
  $env:TRANSFER_MODE='lnd'
  $env:TRANSFER_LND_URL='https://127.0.0.1:18081'
  $env:TRANSFER_LND_CERT=Join-Path $alice 'tls.cert'
  $env:TRANSFER_LND_MACAROON=$credential
  $env:TRANSFER_DATA_FILE=Join-Path $root 'app.json'
  $env:HOST='127.0.0.1'
  $env:PORT='18083'
  $nodes+=Start-Process -FilePath 'node.exe' -ArgumentList @('--import','tsx','src/transfer/server.ts') -WorkingDirectory $project -RedirectStandardOutput (Join-Path $root 'app.out') -RedirectStandardError (Join-Path $root 'app.err') -PassThru -WindowStyle Hidden
  $app='http://127.0.0.1:18083/api'
  Until { (Invoke-RestMethod "$app/config" -TimeoutSec 2).network -eq 'regtest' } 'UraniumTransfer LND mode'
  $json='application/json'
  $created=Invoke-RestMethod "$app/requests" -Method Post -ContentType $json -Body '{"from":"EUR","to":"XOF","target":"50000","rail":"cash"}'
  $url="$app/requests/$($created.request.id)"
  $invoice=Invoke-RestMethod "$url/invoice" -Method Post -ContentType $json -Headers @{Authorization="Bearer $($created.owner)"} -Body '{"amountSat":2200}'
  if ($invoice.state -ne 'waiting') { throw 'Expected waiting before Bob pays' }
  $null=Ln $bob 11010 @('payinvoice','--force',$invoice.invoice.paymentRequest)
  $paid=Invoke-RestMethod "$url/refresh" -Method Post
  if ($paid.state -ne 'paid_wallet' -or $paid.settlement.amountSat -ne 2200 -or $paid.settlement.paymentHash -ne $invoice.invoice.paymentHash -or $paid.cashPayoutVerified) { throw 'Unexpected settlement record' }
  $repeat=Invoke-RestMethod "$url/refresh" -Method Post
  if ($repeat.settlement.settledAt -ne $paid.settlement.settledAt) { throw 'Settlement was not idempotent' }
  Write-Output 'PASS: separate LND nodes paid one BOLT11 invoice (2,200 regtest sats); app matched the hash and amount and did not claim a cash payout.'
  $passed=$true
} finally {
  foreach ($node in $nodes) { if (!$node.HasExited) { Stop-Process -Id $node.Id -ErrorAction SilentlyContinue } }
  foreach ($name in @('TRANSFER_MODE','TRANSFER_LND_URL','TRANSFER_LND_CERT','TRANSFER_LND_MACAROON','TRANSFER_DATA_FILE','HOST','PORT')) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }
  # Keep test-node logs on failure for debugging; they do not contain real credentials or funds.
  if ($passed) { Remove-Item -LiteralPath $root -Recurse -Force } else { Write-Warning "Regtest fixture retained at $root" }
}
