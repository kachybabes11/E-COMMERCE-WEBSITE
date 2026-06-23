export function ensureAuthenticated(req, res, next) {
  if (req.user) {
    return next()
  }
  req.session.messages = req.session.messages || []
  req.session.messages.push({ type: "error", text: "Please sign in to continue." })
  res.redirect("/login")
}

export function ensureAdmin(req, res, next) {
  if (req.user && (req.user.is_admin || req.user.role === "admin")) {
    return next()
  }
  if (req.path.startsWith("/api/")) {
    return res.status(403).json({ ok: false, message: "Admin access required." })
  }
  return res.status(403).send("Unauthorized")
}
