import ky from 'ky';

import _config from './config.json' assert { type: 'json' };
const config: Config = _config;

interface Config {
    network: string;
    rpcuser: string;
    rpcpass: string;
    rpcport: number;
};

type RpcResponse = {
    id: string;
    error: string;
    result: any;
};

const RPCID = 'p2tr';

export async function request(method: string, ...params: string[]) {
    const body = {
        jsonrpc: '2.0',
        id: RPCID,
        method,
        params,
    };
    try {
        const api = ky.extend({
            hooks: {
                beforeRequest: [
                    request => {
                        request.headers.set('Authorization', 'Basic ' + btoa(`${config.rpcuser}:${config.rpcpass}`));
                    }
                ]
            }
        });
        const res = await api.post(`http://localhost:${config.rpcport}`, {
            json: body,
        }).json() as RpcResponse;
        if (!res || res.id !== RPCID) {
            throw new Error('invalid response: ' + method);
        }
        if (res.error) {
            throw res.error;
        }
        return res.result;
    } catch (e: any) {
        console.error(`bitcoinrpc.request error: ${e}`);
        throw e;
    }
}
