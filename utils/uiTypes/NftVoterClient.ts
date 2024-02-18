import { Program, Provider } from '@coral-xyz/anchor'
import {PublicKey, TransactionInstruction} from '@solana/web3.js'
import { NftVoter, IDL } from '../../idls/nft_voter'
import { NftVoterV2, IDLV2 } from '../../idls/nft_voter_v2'
import {
  DEFAULT_NFT_VOTER_PLUGIN,
  DEFAULT_NFT_VOTER_PLUGIN_V2,
} from '@tools/constants'
import { ON_NFT_VOTER_V2 } from '@constants/flags'
import {Client} from "@solana/governance-program-library";
import {VoterWeightAction} from "@solana/spl-governance";
import {getVotingNfts} from "@hooks/queries/plugins/nftVoter";
import {
  getUpdateVoterWeightRecordInstruction,
  getUpdateVoterWeightRecordInstructionV2
} from "@utils/instructions/NftVoter/updateVoterWeight";
import {convertVoterWeightActionToType, getTokenOwnerRecordAddressSync} from "../../VoterWeightPlugins/lib/utils";
import BN from "bn.js";
import {getNftGovpower} from "@hooks/queries/governancePower";

// const programVersion = (ON_NFT_VOTER_V2 ? Program<NftVoterV2> : Program<NftVoter>)
// const idl = ON_NFT_VOTER_V2 ? IDLV2 : IDL
const DEFAULT_NFT_VOTER_PLUGIN_VERSION = ON_NFT_VOTER_V2
    ? DEFAULT_NFT_VOTER_PLUGIN_V2
    : DEFAULT_NFT_VOTER_PLUGIN

export abstract class NftVoterClient extends Client<any> {
  readonly requiresInputVoterWeight = false;

  // NO-OP TODO: Double-check
  async createVoterWeightRecord(): Promise<TransactionInstruction | null> {
    return null;
  }

  // NO-OP
  async createMaxVoterWeightRecord(): Promise<TransactionInstruction | null> {
    return null;
  }

  // NO-OP
  async updateMaxVoterWeightRecord(): Promise<TransactionInstruction | null> {
    return null;
  }
  async calculateVoterWeight(voter: PublicKey, realm: PublicKey, mint: PublicKey): Promise<BN | null> {
    const [TOR] = getTokenOwnerRecordAddressSync(realm, mint, voter)
    return getNftGovpower(this.program.provider.connection, realm, TOR);
  }

  constructor(
      public program: Program<NftVoterV2> | Program<NftVoter>,
      public devnet?: boolean
  ) {
    super(program, devnet)
  }

  static async connect(
      provider: Provider,
      programId = new PublicKey(DEFAULT_NFT_VOTER_PLUGIN_VERSION),
      devnet?: boolean
  ): Promise<NftVoterClient> {
    if (ON_NFT_VOTER_V2) {
      return NftVoterClientV2.connect(
          provider,
          programId,
          devnet,
      )
    } else {
      return NftVoterClientV1.connect(
          provider,
          programId,
          devnet,
      )
    }
  }
}

export class NftVoterClientV1 extends NftVoterClient {
  constructor(public program: Program<NftVoter>, public devnet?: boolean) {
    super(program, devnet)
  }

  async updateVoterWeightRecord(voter: PublicKey, realm: PublicKey, mint: PublicKey, action: VoterWeightAction) {
    const {registrar} = this.getRegistrarPDA(realm, mint);
    const {voterWeightPk} = this.getVoterWeightRecordPDA(realm, mint, voter);
    const votingNfts = await getVotingNfts(
        this.program.provider.connection,
        realm,
        voter
    )

    console.log('on nft voter v1')
    const ix = await getUpdateVoterWeightRecordInstruction(
        this.program,
        voter,
        registrar,
        voterWeightPk,
        votingNfts,
        convertVoterWeightActionToType(action)
    )
    return {pre: [ix]}
  }

  static async connect(
      provider: Provider,
      programId = new PublicKey(DEFAULT_NFT_VOTER_PLUGIN_VERSION),
      devnet?: boolean,
  ): Promise<NftVoterClientV1> {
    return new NftVoterClientV1(
        new Program<NftVoter>(IDL, programId, provider),
        devnet
    )
  }
}

export class NftVoterClientV2 extends NftVoterClient {
  constructor(public program: Program<NftVoterV2>, public devnet?: boolean) {
    super(program, devnet)
  }

  async updateVoterWeightRecord(voter: PublicKey, realm: PublicKey, mint: PublicKey, action: VoterWeightAction) {
    const {registrar} = this.getRegistrarPDA(realm, mint);
    const { voterWeightPk } = this.getVoterWeightRecordPDA(realm, mint, voter);
    const votingNfts = await getVotingNfts(
        this.program.provider.connection,
        realm,
        voter
    )

    console.log('on nft voter v2')
    const {
      createNftTicketIxs,
      updateVoterWeightRecordIx,
    } = await getUpdateVoterWeightRecordInstructionV2(
        this.program,
        voter,
        registrar,
        voterWeightPk,
        votingNfts,
        convertVoterWeightActionToType(action)
    )
    return { pre: [updateVoterWeightRecordIx] , post: createNftTicketIxs }
  }

  static async connect(
      provider: Provider,
      programId = new PublicKey(DEFAULT_NFT_VOTER_PLUGIN_VERSION),
      devnet?: boolean
  ): Promise<NftVoterClientV2> {
    console.log(programId.toBase58())
    return new NftVoterClientV2(
        new Program<NftVoterV2>(IDLV2, programId, provider),
        devnet
    )
  }
}
