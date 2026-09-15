import { Global, Module } from '@nestjs/common'
import { CredentialsCryptoService } from './credentials-crypto.service'

@Global()
@Module({
  providers: [CredentialsCryptoService],
  exports: [CredentialsCryptoService],
})
export class CryptoModule {}
