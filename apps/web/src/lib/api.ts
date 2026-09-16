import axios, { AxiosError } from 'axios'
import type { ApiFieldError } from '@cobra/contracts'
import { supabase } from './supabase'

const { VITE_API_URL } = import.meta.env

export const api = axios.create({ baseURL: VITE_API_URL, timeout: 60_000 })

/** The per-field detail the API sends with a 400, once the interceptor keeps it. */
export const fieldErrorsOf = (error: unknown): ApiFieldError[] =>
  (error as { fieldErrors?: ApiFieldError[] })?.fieldErrors ?? []

// `getSession()` returns the cached token and refreshes it when it is close to
// expiring, so this does not reach the network on every request.
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  if (token) config.headers.Authorization = `Bearer ${token}`

  return config
})

api.interceptors.response.use(
  (response) => {
    // Unwraps the { success, data } envelope so every hook reads the inner type.
    response.data = response.data?.data ?? response.data

    return response
  },
  (error: AxiosError<{ message?: string; details?: ApiFieldError[] }>) => {
    // The API answers in Spanish and says what the operator can do about it;
    // axios' own message says "Request failed with status code 409".
    const { message, details } = error.response?.data ?? {}

    if (message) error.message = message
    // The API names the offending field. Dropping it leaves the panel able to
    // say only "los datos no son válidos" and the operator guessing which one.
    if (details?.length) Object.assign(error, { fieldErrors: details })

    return Promise.reject(error)
  },
)
