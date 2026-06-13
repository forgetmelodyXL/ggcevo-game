import { Context, Schema, h, $ } from 'koishi'
import 'koishi-plugin-ggcevo-sign'


export const name = 'ggcevo-game'

export const inject = {
  required: ['database'],
}

export interface Config { }

export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context, config: Config) {
  // write your plugin here

  
}
