# Historical Teranga materials — not the current app

These archived Docker/LND examples belonged to the old Teranga wallet lab. They are not built, used, or needed by UraniumTransfer. Its Docker Compose file runs only the recipient-first sandbox.

The former regtest configs had weak, hard-coded passwords and listened on public interfaces. Those defaults have been removed. The replacements use placeholders and loopback binds but intentionally no longer form a multi-container network; do not copy them as a working Docker setup. `scripts/setup-nodes.sh` is an unverified historical helper. Use the independently verified disposable-node workflow in [`../scripts/regtest-smoke.ps1`](../scripts/regtest-smoke.ps1) only for regtest.
