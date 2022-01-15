import { useState } from "react";
import {
  Connection,
  clusterApiUrl,
  PublicKey,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  Keypair,
  Transaction,
} from "@solana/web3.js";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";

function App() {
  const [connected, setWalletConnected] = useState(false);
  const [provider, setProvider] = useState({});
  const [loading, setLoading] = useState(false);
  const [isTokenCreated, setTokenCreated] = useState(false);
  const [createdTokenPublicKey, setTokenCreatedPublicKey] = useState(null);
  const [mintingWalletSecretKey, setMintingWalletSecretKey] = useState(null);
  const [supplyCapped, setSupplyCapped] = useState(false);

  const walletConnectionHelper = async () => {
    try {
      if (connected) {
        setProvider();
        setWalletConnected(false);
      } else {
        const wallet = await getProvider();
        if (wallet) {
          await wallet.connect();
          wallet.on("connect", async () => {
            setProvider(wallet);
            setWalletConnected(true);
          });
        }
      }
    } catch (e) {
      console.log(e);
    }
  };

  const getProvider = () => {
    if (window && window.solana) {
      const provider = window.solana;
      if (provider.isPhantom) {
        return provider;
      }
    } else {
      window.open("https://www.phantom.app/", "_blank");
    }
  };

  const airdropHelper = async () => {
    try {
      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
      const airdropSignature = await connection.requestAirdrop(
        new PublicKey(provider.publicKey),
        LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(airdropSignature, {
        commitment: "confirmed",
      });
      console.log(
        `1 SOL airdropped to your wallet ${provider.publicKey.toString()} successfully`
      );
    } catch (e) {}
  };

  const initialMintHelper = async () => {
    try {
      setLoading(true);
      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
      const mintRequester = provider.publicKey;
      const mintingFromWallet = await Keypair.generate();
      setMintingWalletSecretKey(JSON.stringify(mintingFromWallet.secretKey));

      const fromAirDropSignature = await connection.requestAirdrop(
        mintingFromWallet.publicKey,
        LAMPORTS_PER_SOL
      );

      await connection.confirmTransaction(fromAirDropSignature, {
        commitment: "confirmed",
      });

      const creatorToken = await Token.createMint(
        connection,
        mintingFromWallet,
        mintingFromWallet.publicKey,
        null,
        6,
        TOKEN_PROGRAM_ID
      );
      const fromTokenAccount =
        await creatorToken.getOrCreateAssociatedAccountInfo(
          mintingFromWallet.publicKey
        );
      await creatorToken.mintTo(
        fromTokenAccount.address,
        mintingFromWallet.publicKey,
        [],
        1000000
      );

      const toTokenAccount =
        await creatorToken.getOrCreateAssociatedAccountInfo(mintRequester);

      const transaction = new Transaction().add(
        Token.createTransferInstruction(
          TOKEN_PROGRAM_ID,
          fromTokenAccount.address,
          toTokenAccount.address,
          mintingFromWallet.publicKey,
          [],
          1000000
        )
      );

      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [mintingFromWallet],
        { commitment: "confirmed" }
      );

      console.log("Signature", signature);

      setTokenCreatedPublicKey(creatorToken.publicKey);
      setTokenCreated(true);
      setLoading(false);
    } catch (e) {
      setLoading(false);
    }
  };

  const mintAgainHelper = async () => {
    try {
      setLoading(true);
      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
      const createMintingWallet = await Keypair.fromSecretKey(
        Uint8Array.from(Object.values(JSON.parse(mintingWalletSecretKey)))
      );
      const mintRequester = await provider.publicKey;

      const fromAirDropSignature = await connection.requestAirdrop(
        createMintingWallet.publicKey,
        LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(fromAirDropSignature, {
        commitment: "confirmed",
      });

      const creatorToken = new Token(
        connection,
        createdTokenPublicKey,
        TOKEN_PROGRAM_ID,
        createMintingWallet
      );

      const fromTokenAccount =
        await creatorToken.getOrCreateAssociatedAccountInfo(
          createMintingWallet.publicKey
        );

      const toTokenAccount =
        await creatorToken.getOrCreateAssociatedAccountInfo(mintRequester);

      await creatorToken.mintTo(
        fromTokenAccount.address,
        createMintingWallet.publicKey,
        [],
        100000000
      );

      const transaction = new Transaction().add(
        Token.createTransferInstruction(
          TOKEN_PROGRAM_ID,
          fromTokenAccount.address,
          toTokenAccount.address,
          createMintingWallet.publicKey,
          [],
          100000000
        )
      );
      await sendAndConfirmTransaction(
        connection,
        transaction,
        [createMintingWallet],
        { commitment: "confirmed" }
      );

      setLoading(false);
    } catch (err) {
      console.log(err);
      setLoading(false);
    }
  };

  const transferTokenHelper = async () => {
    try {
      setLoading(true);

      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

      const createMintingWallet = Keypair.fromSecretKey(
        Uint8Array.from(Object.values(JSON.parse(mintingWalletSecretKey)))
      );
      const receiverWallet = new PublicKey(
        "G7xeABm6JhWsxPkge2dNadMe9PYh4ev9jk8MSPx6yogD"
      );

      const fromAirDropSignature = await connection.requestAirdrop(
        createMintingWallet.publicKey,
        LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(fromAirDropSignature, {
        commitment: "confirmed",
      });
      console.log("1 SOL airdropped to the wallet for fee");

      const creatorToken = new Token(
        connection,
        createdTokenPublicKey,
        TOKEN_PROGRAM_ID,
        createMintingWallet
      );
      const fromTokenAccount =
        await creatorToken.getOrCreateAssociatedAccountInfo(provider.publicKey);

      const toTokenAccount =
        await creatorToken.getOrCreateAssociatedAccountInfo(receiverWallet);

      const transaction = new Transaction().add(
        Token.createTransferInstruction(
          TOKEN_PROGRAM_ID,
          fromTokenAccount.address,
          toTokenAccount.address,
          provider.publicKey,
          [],
          10000000
        )
      );
      transaction.feePayer = provider.publicKey;
      let blockhashObj = await connection.getRecentBlockhash();
      console.log("blockhashObj", blockhashObj);
      transaction.recentBlockhash = await blockhashObj.blockhash;

      if (transaction) {
        console.log("Txn created successfully");
      }

      let signed = await provider.signTransaction(transaction);
      let signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature);

      console.log("SIGNATURE: ", signature);
      setLoading(false);
    } catch (err) {
      console.log(err);
      setLoading(false);
    }
  };

  const capSupplyHelper = async () => {
    try {
      setLoading(true);
      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

      const createMintingWallet = await Keypair.fromSecretKey(
        Uint8Array.from(Object.values(JSON.parse(mintingWalletSecretKey)))
      );
      const fromAirDropSignature = await connection.requestAirdrop(
        createMintingWallet.publicKey,
        LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(fromAirDropSignature);

      const creatorToken = new Token(
        connection,
        createdTokenPublicKey,
        TOKEN_PROGRAM_ID,
        createMintingWallet
      );
      await creatorToken.setAuthority(
        createdTokenPublicKey,
        null,
        "MintTokens",
        createMintingWallet.publicKey,
        [createMintingWallet]
      );

      setSupplyCapped(true);
      setLoading(false);
    } catch (err) {
      console.log(err);
      setLoading(false);
    }
  };

  return (
    <>
      {connected ? (
        <>
          <p>
            <strong>Public Key:</strong> {provider.publicKey.toString()}
          </p>
          {/*<div>*/}
          {/*  <button onClick={airdropHelper} disabled={loading}>*/}
          {/*    Airdrop 1 Sol*/}
          {/*  </button>*/}
          {/*</div>*/}
          <div>
            <button onClick={initialMintHelper} disabled={loading}>
              Create your own token
            </button>
          </div>
          {isTokenCreated ? (
            <ul>
              <li>
                Mint More 100 tokens:{" "}
                <button
                  disabled={loading || supplyCapped}
                  onClick={mintAgainHelper}
                >
                  Mint Again
                </button>
              </li>
              <li>
                Transfer token:{" "}
                <button
                  disabled={loading || supplyCapped}
                  onClick={transferTokenHelper}
                >
                  Transfer
                </button>
              </li>
              <li>
                Cap Supply:{" "}
                <button
                  disabled={loading || supplyCapped}
                  onClick={capSupplyHelper}
                >
                  Cap
                </button>
              </li>
            </ul>
          ) : null}
        </>
      ) : (
        <p></p>
      )}

      <div>
        <button onClick={walletConnectionHelper} disabled={loading}>
          {!connected ? "Connect Wallet" : "Disconnect Wallet"}
        </button>
      </div>
      {loading ? <p>Loading...</p> : ""}
    </>
  );
}

export default App;
