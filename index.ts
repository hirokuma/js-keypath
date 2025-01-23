import * as rpc from './bitcoinrpc.js';

(async () => {
    const res = await rpc.request('getnewaddress', '', 'bech32');
    console.log(res);
})();
