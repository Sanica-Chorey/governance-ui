import { EndpointTypes } from '@models/types'
import {
  VoteRecord,
  getGovernanceAccounts,
  getVoteRecord,
  pubkeyFilter,
} from '@solana/spl-governance'
import { Connection, PublicKey } from '@solana/web3.js'
import { useQuery } from '@tanstack/react-query'
import { getNetworkFromEndpoint } from '@utils/connection'
import asFindable from '@utils/queries/asFindable'
import useWalletStore from 'stores/useWalletStore'
import { useAddressQuery_SelectedProposalVoteRecord } from './addresses/voteRecord'
import queryClient from './queryClient'
import { cluster } from 'd3'
import { useRouter } from 'next/router'
import { useRealmQuery } from './realm'

export const voteRecordQueryKeys = {
  all: (cluster: EndpointTypes) => [cluster, 'VoteRecord'],
  byPubkey: (cluster: EndpointTypes, k: PublicKey) => [
    ...voteRecordQueryKeys.all(cluster),
    k.toString(),
  ],
  byRealmXOwner: (
    cluster: EndpointTypes,
    realm: PublicKey,
    owner: PublicKey
  ) => [...voteRecordQueryKeys.all(cluster), realm, owner],
}

// currently unused
export const useVoteRecordByTokenOwnerRecordQuery = (
  tokenOwnerRecordAddress?: PublicKey
) => {
  const pda = useAddressQuery_SelectedProposalVoteRecord(
    tokenOwnerRecordAddress
  )
  const query = useVoteRecordByPubkeyQuery(pda.data)
  return query
}

export const useVoteRecordByPubkeyQuery = (pubkey?: PublicKey) => {
  const connection = useWalletStore((s) => s.connection)

  const enabled = pubkey !== undefined
  const query = useQuery({
    queryKey: enabled
      ? voteRecordQueryKeys.byPubkey(connection.cluster, pubkey)
      : undefined,
    queryFn: async () => {
      if (!enabled) throw new Error()
      return asFindable(getVoteRecord)(connection.current, pubkey)
    },
    enabled,
  })

  return query
}

export const useVoteRecordsForRealmByOwner = (owner?: PublicKey) => {
  const connection = useWalletStore((s) => s.connection)
  const realm = useRealmQuery().data?.result

  const enabled = owner !== undefined && realm?.pubkey !== undefined
  const query = useQuery({
    queryKey: enabled
      ? voteRecordQueryKeys.byRealmXOwner(
          connection.cluster,
          realm?.pubkey,
          owner
        )
      : undefined,
    queryFn: async () => {
      if (!enabled) throw new Error()
      const results = await getGovernanceAccounts(
        connection.current,
        realm.owner,
        VoteRecord,
        [pubkeyFilter(33, owner)!]
      )

      // since we got the data for these accounts, lets save it
      results.forEach((x) => {
        queryClient.setQueryData(
          voteRecordQueryKeys.byPubkey(connection.cluster, x.pubkey),
          { found: true, result: x }
        )
      })

      return results
    },
    enabled,
  })

  return query
}

export const fetchVoteRecordByPubkey = (
  connection: Connection,
  pubkey: PublicKey
) => {
  const cluster = getNetworkFromEndpoint(connection.rpcEndpoint)
  return queryClient.fetchQuery({
    queryKey: voteRecordQueryKeys.byPubkey(cluster, pubkey),
    queryFn: () => asFindable(getVoteRecord)(connection, pubkey),
  })
}
