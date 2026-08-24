import { useMutation } from '@tanstack/react-query'
import {
  queryReport,
  type ReportDefinitionKey,
} from '../../api/client'
import type { ReportQueryRequest } from '../../api/generated/types'

export type ReportQueryVariables = {
  definitionKey: ReportDefinitionKey
  request: ReportQueryRequest
}

export function useReportQuery() {
  return useMutation({
    mutationFn: ({ definitionKey, request }: ReportQueryVariables) =>
      queryReport(definitionKey, request),
  })
}
