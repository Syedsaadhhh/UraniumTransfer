#!/usr/bin/env bash
# Bring the regtest Lightning network to a usable state for the docker path.
# Requires: docker compose up -d bitcoind lnd lnd-peer
set -euo pipefail

# 1. Mine an initial batch so bitcoind has spendable coinbase.
docker compose exec -T bitcoind bitcoin-cli -regtest -rpcuser=teranga -rpcpassword=teranga createwallet demo || true
docker compose exec -T bitcoind bitcoin-cli -regtest -rpcuser=teranga -rpcpassword=teranga -generate 101 >/dev/null

# 2. Create + unlock the LND wallets, then get their pubkeys.
docker compose exec -T lnd lncli create
docker compose exec -T lnd-peer lncli create
ALICE=$(docker compose exec -T lnd lncli getinfo | jq -r .identity_pubkey)
BOB=$(docker compose exec -T lnd-peer lncli getinfo | jq -r .identity_pubkey)

# 3. Open a channel from the wallet node to its peer so it has outbound liquidity.
docker compose exec -T lnd lncli connect "$BOB@lnd-peer:9735" || true
docker compose exec -T lnd lncli openchannel --node_key "$BOB" --local_amt 1000000 --push_amt 500000 >/dev/null

# 4. Confirm the channel.
docker compose exec -T bitcoind bitcoin-cli -regtest -rpcuser=teranga -rpcpassword=teranga -generate 3 >/dev/null
echo "Alice=$ALICE"
echo "Bob=$BOB"
echo "channel open. backend -> http://localhost:3000"