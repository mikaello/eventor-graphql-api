declare module "rescript-eventor/src/NativeOrganisation.res.mjs" {
  export function parse(
    xml: string,
  ): import("rescript-eventor/Eventor").Result<
    import("rescript-eventor/Eventor").NativeOrganisation[]
  >;
}

declare module "rescript-eventor/src/NativePerson.res.mjs" {
  export function parse(
    xml: string,
  ): import("rescript-eventor/Eventor").Result<import("rescript-eventor/Eventor").NativePerson[]>;
}

declare module "rescript-eventor/src/NativeEventClass.res.mjs" {
  export function parse(
    xml: string,
  ): import("rescript-eventor/Eventor").Result<
    import("rescript-eventor/Eventor").NativeEventClass[]
  >;
}

declare module "rescript-eventor/src/NativeDocument.res.mjs" {
  export function parse(
    xml: string,
  ): import("rescript-eventor/Eventor").Result<
    import("rescript-eventor/Eventor").NativeDocument[]
  >;
}

declare module "rescript-eventor/src/NativeEntryFee.res.mjs" {
  export function parse(
    xml: string,
  ): import("rescript-eventor/Eventor").Result<
    import("rescript-eventor/Eventor").NativeEntryFee[]
  >;
}

declare module "rescript-eventor/src/NativeCompetitorCount.res.mjs" {
  export function parse(
    xml: string,
  ): import("rescript-eventor/Eventor").Result<
    import("rescript-eventor/Eventor").NativeCompetitorCount[]
  >;
}
