import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { type CredentialPayload, CredentialsCrypto } from '@cobra/data'

/**
 * The Nest-facing wrapper of `CredentialsCrypto`.
 *
 * The cipher itself lives in @cobra/data because the worker needs it too, and a
 * second implementation of the thing that protects every client's access tokens
 * is not a trade worth making.
 */
@Injectable()
export class CredentialsCryptoService {
  private readonly crypto: CredentialsCrypto

  constructor(config: ConfigService) {
    this.crypto = new CredentialsCrypto(config.getOrThrow<string>('CREDENTIALS_MASTER_KEY'))
  }

  encrypt(payload: CredentialPayload): { ciphertext: string; last4: string } {
    return this.crypto.encrypt(payload)
  }

  decrypt(ciphertext: string): CredentialPayload {
    try {
      return this.crypto.decrypt(ciphertext)
    } catch {
      throw new InternalServerErrorException('No se pudo descifrar la credencial')
    }
  }
}
