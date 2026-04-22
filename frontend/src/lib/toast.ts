import { toast as _toast } from "sonner"
import type { ExternalToast } from "sonner"

type ToastMsg = Parameters<typeof _toast>[0]

const success = (msg: ToastMsg, opts?: ExternalToast) =>
  _toast.success(msg, { duration: 3000, ...opts })

const error = (msg: ToastMsg, opts?: ExternalToast) =>
  _toast.error(msg, { duration: 5000, ...opts })

const info = (msg: ToastMsg, opts?: ExternalToast) =>
  _toast.info(msg, { duration: 3000, ...opts })

const warning = (msg: ToastMsg, opts?: ExternalToast) =>
  _toast.warning(msg, { duration: 4000, ...opts })

export const toast = Object.assign(
  (msg: ToastMsg, opts?: ExternalToast) => _toast(msg, { duration: 3000, ...opts }),
  { ..._toast, success, error, info, warning }
)
