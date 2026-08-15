import { rpc, Contract, Address, Account, nativeToScVal, scValToNative, xdr, TransactionBuilder, BASE_FEE, TimeoutInfinite } from '@stellar/stellar-sdk';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
const CONTRACT_ID = 'CAM2SW6NSRA2CXP34H5G6Y2EIUOYENP3NAYAD76X3ZHG72NUJO63XPAP';
const server = new rpc.Server(RPC_URL);

async function test() {
  try {
    const contract = new Contract(CONTRACT_ID);
    const tx = new TransactionBuilder(
      new Account("GBB35PEWHYNQJP2YFJ4RAQE7M4DJ2HT64EBKO6CT242K27BWOBAFT22K", "0"),
      {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      }
    )
      .addOperation(contract.call("get_chit_status", nativeToScVal(1, { type: 'u32' })))
      .setTimeout(TimeoutInfinite)
      .build();

    const simulated = await server.simulateTransaction(tx);
    console.log("Simulation success?", rpc.Api.isSimulationSuccess(simulated));
    
    if (rpc.Api.isSimulationError(simulated)) {
      console.error("Simulation error:", simulated.error);
      return;
    }

    const scVal = simulated.result?.retval;
    console.log("scVal exists?", !!scVal);
    if (scVal) {
      console.log("scVal Type:", scVal.switch().name);
      const native = scValToNative(scVal);
      console.log("Parsed native object:", JSON.stringify(native, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value, 2));
    }
  } catch (e) {
    console.error("Caught error:", e);
  }
}

test();
