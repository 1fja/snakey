let socket = null
let roomID = null

let myPublicKey = null
let myPrivateKey = null
let peerPublicKey = null
let keysReady = false

openpgp.generateKey({
  type: "rsa",
  rsaBits: 2048,
  userIDs: [{ name: "anon" }]
})
.then(keys => {
  myPublicKey = keys.publicKey
  return openpgp.readPrivateKey({ armoredKey: keys.privateKey })
})
.then(priv => {
  myPrivateKey = priv
  keysReady = true
})

function openInvite() {
  window.open(location.origin + "/pair/create", "_blank")
  alert("Copy the room ID and paste it when connecting")
}

function connectPeer() {
  if (!keysReady) {
    alert("Wait keys generation")
    return
  }

  if (!roomID) {
    roomID = prompt("Paste room ID")
    if (!roomID) return
  }

  const protocol = location.protocol === "https:" ? "wss://" : "ws://"
  socket = new WebSocket(protocol + location.host + "/ws?room=" + roomID)

  socket.onopen = function () {
    socket.send(JSON.stringify({
      type: "key",
      key: myPublicKey
    }))
  }

  socket.onmessage = function (e) {
    const msg = JSON.parse(e.data)

    if (msg.type === "peer-key") {
      openpgp.readKey({ armoredKey: msg.key })
        .then(k => {
          peerPublicKey = k
          document.getElementById("status").innerText = "Connected"
          document.getElementById("chat").style.display = "block"
        })
      return
    }

    if (msg.type === "msg") {
      openpgp.readMessage({ armoredMessage: msg.data })
        .then(m => {
          return openpgp.decrypt({
            message: m,
            decryptionKeys: myPrivateKey
          })
        })
        .then(res => {
          const clean = res.data.split("::PAD::")[0]
          addMsg("Peer: " + clean)
        })
        .catch(() => {})
    }
  }

  socket.onclose = function () {
    document.getElementById("status").innerText = "Disconnected"
  }
}

function sendMsg() {
  if (!peerPublicKey) {
    alert("Waiting peer")
    return
  }

  const input = document.getElementById("msg")
  const text = input.value
  if (!text) return
  input.value = ""

  const pad = " ".repeat(Math.floor(Math.random() * 150) + 50)
  const payload = text + "::PAD::" + pad

  openpgp.createMessage({ text: payload })
    .then(msg => {
      return openpgp.encrypt({
        message: msg,
        encryptionKeys: peerPublicKey
      })
    })
    .then(enc => {
      socket.send(JSON.stringify({
        type: "msg",
        data: enc
      }))
      addMsg("You: " + text)
    })
}

function addMsg(text) {
  const div = document.createElement("div")
  div.textContent = text
  document.getElementById("messages").appendChild(div)
}

window.addEventListener("beforeunload", function () {
  myPrivateKey = null
  myPublicKey = null
  peerPublicKey = null
  socket = null
})
/* =====================
   FORWARD SECRECY + FAKE TRAFFIC (PLUGIN)
===================== */

function generateEphemeralKey() {
  return openpgp.generateKey({
    type: "rsa",
    rsaBits: 1024,
    userIDs: [{ name: "ephemeral" }]
  })
}

/* Hook seguro: intercepta envio real */
const _originalSendMsg = sendMsg

sendMsg = function () {
  if (!peerPublicKey || !socket || socket.readyState !== 1) {
    alert("Waiting peer")
    return
  }

  const input = document.getElementById("msg")
  const text = input.value
  if (!text) return
  input.value = ""

  generateEphemeralKey()
    .then(keys => {
      return openpgp.readKey({ armoredKey: keys.publicKey })
        .then(ephPub => {
          const pad = " ".repeat(Math.floor(Math.random() * 200) + 50)
          const payload = text + "::PAD::" + pad

          return openpgp.createMessage({ text: payload })
            .then(msg => {
              return openpgp.encrypt({
                message: msg,
                encryptionKeys: [peerPublicKey, ephPub]
              })
            })
        })
    })
    .then(enc => {
      const jitter = Math.floor(Math.random() * 400) + 100
      setTimeout(() => {
        socket.send(JSON.stringify({
          type: "msg",
          data: enc
        }))
      }, jitter)

      addMsg("You: " + text)
    })
}

/* =====================
   FAKE TRAFFIC REALISTA (PGP VÁLIDO)
===================== */

function sendFakePGP() {
  if (!peerPublicKey || !socket || socket.readyState !== 1) return

  generateEphemeralKey()
    .then(keys => {
      return openpgp.readKey({ armoredKey: keys.publicKey })
        .then(ephPub => {
          return openpgp.createMessage({
            text: Math.random().toString(36).repeat(8)
          }).then(msg => {
            return openpgp.encrypt({
              message: msg,
              encryptionKeys: [peerPublicKey, ephPub]
            })
          })
        })
    })
    .then(enc => {
      const jitter = Math.floor(Math.random() * 800) + 200
      setTimeout(() => {
        socket.send(JSON.stringify({
          type: "msg",
          data: enc
        }))
      }, jitter)
    })
}

/* Loop de tráfego falso */
setInterval(function () {
  sendFakePGP()
}, Math.random() * 4000 + 3000)
