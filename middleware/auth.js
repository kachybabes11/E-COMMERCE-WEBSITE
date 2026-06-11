export function ensureAuthenticated(req, res, next) {
  if (req.user) {
    return next()
  }
  req.session.messages = req.session.messages || []
  req.session.messages.push({ type: "error", text: "Please sign in to continue." })
  res.redirect("/login")
}

export function ensureAdmin(req, res, next) {
  if (req.user && req.user.is_admin) {
    return next()
  }
  res.status(403).send("Unauthorized")
}
