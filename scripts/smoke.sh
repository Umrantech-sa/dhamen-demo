#!/usr/bin/env bash
# Smoke-tests every mock Dhamen endpoint (Integration Guide v1.5) against a running dev server.
# Usage: scripts/smoke.sh [base-url]   (default http://localhost:3000)
set -uo pipefail

BASE="${1:-http://localhost:3000}"
H=(-H "Content-Type: application/json"
   -H "App-key: ${NEXT_PUBLIC_DHAMEN_APP_KEY:-5f0c7a52-3b1e-4f7e-9d1a-8a4c2e6b9f10}"
   -H "App-id: ${NEXT_PUBLIC_DHAMEN_APP_ID:-b2d4e6f8-1a3c-4e5f-8a7b-9c0d1e2f3a4b}"
   -H "ClientId: ${NEXT_PUBLIC_DHAMEN_CLIENT_ID:-e8a1c3f5-7b9d-4c2e-a6f8-0b1d3e5f7a9c}"
   -H "api-version: 2"
   -H "x-demo-source: smoke")
PASS=0; FAIL=0
RUN=$RANDOM$RANDOM

# call <name> <method> <path> <json|-> <expected messageCode or 200> [extra curl args...]
call() {
  local name=$1 method=$2 path=$3 body=$4 expect=$5; shift 5
  local args=(-s -X "$method")
  if [[ "${1:-}" == "--no-auth" ]]; then shift; args+=(-H "Content-Type: application/json" "$@"); else args+=("${H[@]}" "$@"); fi
  [[ "$body" != "-" ]] && args+=(-d "$body")
  RESP=$(curl "${args[@]}" "$BASE/api/payments/$path")
  local code
  code=$(printf '%s' "$RESP" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(j.messageCode??200)}catch{console.log("invalid-json")}})')
  if [[ "$code" == "$expect" ]]; then PASS=$((PASS+1)); printf '  \033[32m✓\033[0m %-44s %s\n' "$name" "$code"
  else FAIL=$((FAIL+1)); printf '  \033[31m✗\033[0m %-44s expected %s got %s\n    %s\n' "$name" "$expect" "$code" "$RESP"; fi
}
field() { printf '%s' "$RESP" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(eval('JSON.parse(s)'+process.argv[1])))" "$1"; }

ID="1$(printf '%09d' $((RUN % 1000000000)))"
SID="7$(printf '%09d' $((RUN % 1000000000)))"
REF="SMOKE-$RUN"

echo "Headers (Appendix A)"
call "missing App-key → 401" POST create-customer '{}' 401 --no-auth
call "wrong ClientId → 403" POST create-customer '{}' 403 -H "ClientId: nope"
call "unknown route → 404" POST does-not-exist '{}' 404

echo "Customers"
call "create-customer" POST create-customer "{\"identityNumber\":\"$ID\",\"name\":\"Smoke Customer\",\"mobile\":\"966500000001\"}" 200
CUSTOMER_ID=$(field .customerId)
call "create-customer duplicate → B001" POST create-customer "{\"identityNumber\":\"$ID\",\"name\":\"Smoke\"}" B001
call "create-customer invalid → M001" POST create-customer '{"identityNumber":"12","name":"","iban":"XX"}' M001
call "update-customer" POST update-customer "{\"identityNumber\":\"$ID\",\"name\":\"Smoke Customer 2\",\"email\":\"smoke@example.sa\"}" 200
call "deposit-money" POST deposit-money "{\"customerId\":\"$CUSTOMER_ID\",\"amount\":500,\"paymentIWalletNumber\":\"500802301103\"}" 200
call "customer-balance" GET "customer-balance/$CUSTOMER_ID" - 200
call "customer-balance unknown → D002" GET "customer-balance/00000000-0000-0000-0000-000000000000" - D002

echo "Suppliers"
call "create-supplier" POST create-supplier "{\"name\":\"Smoke Supplier\",\"iban\":\"SA0380000000608010167519\",\"identityNumber\":\"$SID\",\"payoutThresholdAmount\":100000}" 200
SUPPLIER_ID=$(field .supplierId)
call "create-supplier duplicate → B001" POST create-supplier "{\"name\":\"Dup\",\"iban\":\"SA0380000000608010167519\",\"identityNumber\":\"$SID\"}" B001
call "update-supplier" POST update-supplier "{\"supplierId\":\"$SUPPLIER_ID\",\"name\":\"Smoke Supplier Co\",\"iban\":\"SA0380000000608010167519\",\"identityNumber\":\"$SID\"}" 200
call "supplier-balance" GET "supplier-balance/$SUPPLIER_ID" - 200

echo "Supplier payment (split)"
call "supplier-payment" POST supplier-payment "{\"paymentReferenceID\":\"SP-$REF\",\"supplierPayments\":[{\"supplierId\":\"$SUPPLIER_ID\",\"amount\":200,\"customerId\":\"$CUSTOMER_ID\"},{\"supplierId\":\"$SUPPLIER_ID\",\"amount\":50}]}" 200
call "supplier-payment duplicate ref → C033" POST supplier-payment "{\"paymentReferenceId\":\"SP-$REF\",\"supplierPayments\":[{\"supplierId\":\"$SUPPLIER_ID\",\"amount\":1}]}" C033
call "supplier-payment unknown supplier → C015" POST supplier-payment "{\"paymentReferenceId\":\"SP2-$REF\",\"supplierPayments\":[{\"supplierId\":\"00000000-0000-0000-0000-000000000000\",\"amount\":1}]}" C015
call "supplier-payment-status" POST supplier-payment-status "{\"supplierId\":\"$SUPPLIER_ID\",\"paymentReferenceId\":\"SP-$REF\"}" 200

echo "Customer payment · pre-auth"
call "customer-payment (pre-auth)" POST customer-payment "{\"paymentReferenceId\":\"$REF\",\"customerPayments\":[{\"name\":\"Smoke\",\"customerIdentifier\":\"$ID\",\"amount\":300,\"isPreAuth\":true,\"enableRecurring\":true}]}" 200
INVOICE=$(field .customerPayments[0].invoiceId)
call "customer-payment duplicate ref → C033" POST customer-payment "{\"paymentReferenceId\":\"$REF\",\"customerPayments\":[{\"name\":\"x\",\"customerIdentifier\":\"1\",\"amount\":1}]}" C033
call "customer-payment same identifier → C057" POST customer-payment "{\"paymentReferenceId\":\"X-$REF\",\"customerPayments\":[{\"name\":\"a\",\"customerIdentifier\":\"1\",\"amount\":1},{\"name\":\"b\",\"customerIdentifier\":\"1\",\"amount\":1}]}" C057
call "customer-payment amount 0 → C064" POST customer-payment "{\"paymentReferenceId\":\"Y-$REF\",\"customerPayments\":[{\"name\":\"a\",\"customerIdentifier\":\"1\",\"amount\":0}]}" C064
call "capture before payment → InvPay003" PUT capture "{\"paymentReferenceId\":\"$REF\",\"customerIdentifier\":\"$ID\"}" InvPay003
curl -s -X POST "$BASE/api/demo/checkout/$INVOICE" -d '{"method":"card","cardNumber":"4464040000000007"}' >/dev/null
call "customer-payment-status (paid)" POST customer-payment-status "{\"paymentReferenceId\":\"$REF\",\"customerIdentifier\":\"$ID\"}" 200
call "partial capture w/o requestId → M001" PUT capture "{\"paymentReferenceId\":\"$REF\",\"customerIdentifier\":\"$ID\",\"amount\":100}" M001
call "capture (partial)" PUT capture "{\"paymentReferenceId\":\"$REF\",\"customerIdentifier\":\"$ID\",\"amount\":250,\"requestId\":\"CP-$RUN\"}" 200
call "capture again → InvPay004" PUT capture "{\"paymentReferenceId\":\"$REF\",\"customerIdentifier\":\"$ID\"}" InvPay004
call "reverse after capture → InvPay004" PUT reverse "{\"paymentReferenceId\":\"$REF\",\"customerIdentifier\":\"$ID\"}" InvPay004
call "cancel paid link → InvPay007" PUT cancel "{\"paymentReferenceId\":\"$REF\"}" InvPay007
call "refund (partial)" PUT refund "{\"paymentReferenceId\":\"$REF\",\"customerIdentifier\":\"$ID\",\"amount\":50,\"requestId\":\"RF-$RUN\"}" 200
call "refund-iban (rest)" POST refund-iban "{\"paymentReferenceId\":\"$REF\",\"customerName\":\"Smoke\",\"iban\":\"SA9478000000001300051797\"}" 200
call "refund again → InvPay006" PUT refund "{\"paymentReferenceId\":\"$REF\",\"customerIdentifier\":\"$ID\"}" InvPay006
call "subsequent payment" POST customer-subsequent-payment "{\"paymentReferenceId\":\"SUB-$REF\",\"originalPaymentReferenceId\":\"$REF\",\"customerIdentifier\":\"$ID\",\"amount\":20}" 200

echo "Customer payment · reverse / cancel"
call "customer-payment (pre-auth 2)" POST customer-payment "{\"paymentReferenceId\":\"R-$REF\",\"customerPayments\":[{\"name\":\"Smoke\",\"customerIdentifier\":\"$ID\",\"amount\":90,\"isPreAuth\":true}]}" 200
INVOICE2=$(field .customerPayments[0].invoiceId)
curl -s -X POST "$BASE/api/demo/checkout/$INVOICE2" -d '{"method":"card","cardNumber":"4111111111111111"}' >/dev/null
call "reverse" PUT reverse "{\"paymentReferenceId\":\"R-$REF\",\"customerIdentifier\":\"$ID\"}" 200
call "reverse again → InvPay005" PUT reverse "{\"paymentReferenceId\":\"R-$REF\",\"customerIdentifier\":\"$ID\"}" InvPay005
call "subsequent w/o recurring → C037" POST customer-subsequent-payment "{\"paymentReferenceId\":\"S2-$REF\",\"originalPaymentReferenceId\":\"R-$REF\",\"customerIdentifier\":\"$ID\",\"amount\":5}" C037
call "customer-payment (guest)" POST customer-payment "{\"paymentReferenceId\":\"C-$REF\",\"customerPayments\":[{\"name\":\"Guest\",\"customerIdentifier\":\"99$RUN\",\"amount\":15}]}" 200
call "cancel" PUT cancel "{\"paymentReferenceId\":\"C-$REF\"}" 200
call "capture unknown → InvPay002" PUT capture '{"paymentReferenceId":"nope","customerIdentifier":"1"}' InvPay002

echo "SADAD & authority"
call "customer-sadad-payment" POST customer-sadad-payment "{\"paymentReferenceId\":\"SADAD-$REF\",\"name\":\"Smoke\",\"customerIdentifier\":\"$ID\",\"amount\":5,\"supplierId\":\"$SUPPLIER_ID\"}" 200
call "get-authority-balance" GET "get-authority-balance?authorityProfileId=A8118995-97D7-4AD6-9E21-5734F1E33607" - 200

echo
echo "Passed $PASS · Failed $FAIL"
[[ $FAIL -eq 0 ]]
