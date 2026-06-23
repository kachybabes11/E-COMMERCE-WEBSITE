export function notFoundHandler(req, res) {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ ok: false, message: "Route not found." })
  }
  return res.status(404).render("404")
}

export function appErrorHandler(err, req, res, next) {
  console.error(err)

  if (err.code === "EBADCSRFTOKEN") {
    if (req.path.startsWith("/api/")) {
      return res.status(403).json({ ok: false, message: "Session expired or invalid CSRF token." })
    }
    return res.status(403).send("Session expired or form tampered with.")
  }

  if (req.path.startsWith("/api/")) {
    return res.status(500).json({ ok: false, message: "Internal server error." })
  }

  return res.status(500).send("Something went wrong.")
}
