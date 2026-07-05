import { Global, Injectable, Module, OnModuleInit } from '@nestjs/common';

// On Hanzo Tasks, per-workflow search attributes are carried on the start wire
// and stored on the execution (visibility-queryable) with no namespace-level
// registration step, and TemporalService registers the namespace on init. This
// module is retained as a no-op so existing app wiring keeps resolving.
@Injectable()
export class TemporalRegister implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    /* no-op — search attributes require no pre-registration on Hanzo Tasks */
  }
}

@Global()
@Module({
  imports: [],
  controllers: [],
  providers: [TemporalRegister],
  get exports() {
    return this.providers;
  },
})
export class TemporalRegisterMissingSearchAttributesModule {}
