import * as _bip32 from 'bip32';
import * as bitcoin from "bitcoinjs-lib";
import { randomBytes } from 'crypto';
import * as ecc from 'tiny-secp256k1';

import * as rpc from './bitcoinrpc.js';

type GetRawTransaction = {
  confirmations?: number;
  vout: [
    {
      value: number;
      n: number;
      scriptPubKey: {
        address: string;
      },
    },
  ],
};

async function sleepMsec(msec: number) {
  new Promise(resolve => setTimeout(resolve, msec));
}

const FEE = 1000;

const rng = (size: number) => randomBytes(size);
const bip32 = _bip32.BIP32Factory(ecc);
const network = bitcoin.networks.regtest;

bitcoin.initEccLib(ecc);

(async () => {
  let res;

  // for generatetoaddress
  const genAddr = await rpc.request('getnewaddress', '', 'bech32m') as string;

  // target key
  const internalKey = bip32.fromSeed(rng(64), network);

  // P2TR key path address
  const keyPath = bitcoin.payments.p2wpkh({
      pubkey: internalKey.publicKey,
      network
  });
  const keyPathAddr = keyPath.address!;

  // send to address
  const txid = await rpc.request('sendtoaddress', keyPathAddr, 0.001) as string;
  console.log(`send to ${keyPathAddr}, txid: ${txid}`);

  // generate block
  console.log(`generate block: ${genAddr}`);
  let blockhash = await rpc.request('generatetoaddress', 1, genAddr) as string[];
  console.log(blockhash);

  // wait for confirmation
  while (true) {
    res = await rpc.request('getrawtransaction', txid, 1) as GetRawTransaction;
    if (res.confirmations && res.confirmations > 0) {
      break;
    }
    await sleepMsec(3000);
  }
  console.log(JSON.stringify(res, null, 2));

  console.log('\n\n---------------- redeem ----------------\n');
  // outpoint
  let voutIndex = -1;
  for (const vout of res.vout) {
    if (vout.scriptPubKey.address === keyPathAddr) {
      voutIndex = vout.n;
      break;
    }
  }
  if (voutIndex === -1) {
    console.error('vout not found');
    return;
  }

  // create redeem transaction
  const inputSats = res.vout[voutIndex].value * 100_000_000;
  const psbt = new bitcoin.Psbt({ network });
  psbt.addInput({
    hash: txid,
    index: voutIndex,
    witnessUtxo: {
      value: inputSats,
      script: keyPath.output!,
    },
  });

  const recvAddr = await rpc.request('getnewaddress') as string;
  psbt.addOutput({
    address: recvAddr,
    value: inputSats - FEE,
  });

  psbt.signInput(0, internalKey);
  psbt.finalizeAllInputs();

  // broadcast redeem transaction
  const tx = psbt.extractTransaction();
  res = await rpc.request('sendrawtransaction', tx.toHex());
  console.log(`Send to ${recvAddr}: ${res}`);

  const redeemTxid = tx.getId();
  console.log(`Redeem txid: ${redeemTxid}`);

  // generate block
  console.log(`generate block: ${genAddr}`);
  blockhash = await rpc.request('generatetoaddress', 1, genAddr) as string[];
  console.log(blockhash);

  // wait for confirmation
  while (true) {
    res = await rpc.request('getrawtransaction', redeemTxid, 1) as GetRawTransaction;
    if (res.confirmations && res.confirmations > 0) {
      break;
    }
    await sleepMsec(3000);
  }
  console.log(JSON.stringify(res, null, 2));

  console.log('\n---------------- done ----------------');
})();
