import * as _bip32 from 'bip32';
import * as bitcoin from "bitcoinjs-lib";
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371.js";
import { randomBytes } from 'crypto';
// import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from 'ecpair';
import * as ecc from 'tiny-secp256k1';

import * as rpc from './bitcoinrpc.js';

async function sleepMsec(msec: number) {
  new Promise(resolve => setTimeout(resolve, msec));
}

const rng = (size: number) => randomBytes(size);
const bip32 = _bip32.BIP32Factory(ecc);
// const ECPair: ECPairAPI = ECPairFactory(tinysecp);
const network = bitcoin.networks.regtest;

bitcoin.initEccLib(ecc);

(async () => {
  let res;

  // target key
  const internalKey = bip32.fromSeed(rng(64), network);

  const tweakedSigner = internalKey.tweak(
    bitcoin.crypto.taggedHash('TapTweak', toXOnly(internalKey.publicKey)),
  );
  const keyPath = bitcoin.payments.p2tr({
      pubkey: toXOnly(tweakedSigner.publicKey),
      network
  });
  const keyPathAddr = keyPath.address!;
  console.log(`sent: bitcoin-cli -regtest sendtoaddress ${keyPathAddr} 0.001`);

  const txid = await rpc.request('sendtoaddress', keyPathAddr, 0.001) as string;
  console.log(`sent txid: ${txid}`);
  await sleepMsec(3000);

  while (true) {
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
    res = await rpc.request('getrawtransaction', txid, 1) as GetRawTransaction;
    if (res.confirmations && res.confirmations > 0) {
      break;
    }
    await sleepMsec(3000);
  }
  console.log('detected');
  console.log(JSON.stringify(res, null, 2));

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
  console.log(`voutIndex: ${voutIndex}`);
})();
