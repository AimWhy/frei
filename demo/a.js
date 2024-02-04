const crypto = require("crypto");

// let { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
//   modulusLength: 2048,
//   publicKeyEncoding: { type: "spki", format: "pem" },
//   privateKeyEncoding: { type: "pkcs8", format: "pem" },
// });

// privateKey = "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDrkMqy12EG8aYt\n3aesdooSD+TMswFu7URbaamIS7iblMvBjKCbxPyIXXKgSmzultIi07t9h3BjODDn\nDAolmDUTmBWt8Im7ONAsE4hnXuNktEKUl5zXSic+4nIUc6ghsDWGQoY6p0Zi8Wt3\nhJ2oBRT0EJYFOkJNKNSn2Bej0ksBo+N5DjkIKRa3Mk4Fxjd3BQqdx8IPA2wBy+lC\nk3whzaNqlvTY8nlTfoNgjiwRNtbrGz/qViC7qjG0hVlu43l5ZYB6ivzflBOHgBhA\ncGbScMQKrlnrGjHitKvcVPXnXQvAhnfhRYT0NP8ARwjjpls9wZnWzjvdWVZPo2/3\n8mpDAZKxAgMBAAECggEACpwEf8Ddji+CBDIlzsmuoZj0/WyD1a16qldRmww2A05/\nTXdPoH8Nv00zesP/W1Dlo/Xp+Cxfw8g7GPIyNCFCerXF0YYHiKwgDBbRH5QRem6i\nn7NNuBCPQJt4TIgs/AobTwcIqUmcDPFsnVRsDq4z6bjO2OttIwaCFWZ7zMANlW7o\nZ8lW4sp3oIRUh8PKg89/1txUHZe3qMtWBEUBaIdyP0u+sL4fyXx6o7biKl1+w6Rm\nlvD9mZc5VaGE5PKxztipZyh1ib4uh5PX+NcidmMEXAlxPom6CEjlelN4tchtRNmV\nTKc4xybkmiz7QWgbwVrKQomBDA+NwHVfJgLebHCdpQKBgQD3yq7nAnuBGC3M9uaJ\nsS4x7FBcOhe+pFTY+c+tkio3ACSpt9Nmk6tuILPFcg5nQ7LGjMPAxtkGkNMu8VTj\nLf2oag8bS8lvidqBUACOl/g1dYLB+ax+zvajXJlplXAOAM25PuQCcnuBSUA7bQLp\n3jBijYudBlbjBotL1tAjHZCvqwKBgQDzXm3GZ0b5iUfjxzw5nf/t6Tg7I15XmhcZ\nG26FUGU6ZQMTuVmKpRaioe3WxZSFLh2ML3BFii66fSgpLYpM9dHOp8EPjlKrH6RM\nfm9E4rc6N861orVgVceJTbjqBl8YaLb32yTvNKZJf0QVcfPMmktflmnFpW8rRORA\noW+anLibEwKBgQDa4fQ75Yp5T4Vtr4+Xg6Z9vPSDc2F0Kq80dv8HoLyflwXL0bDw\nxHLDNin2uLiWaUurbb6hNEWTMi0KI23Lu918fitX/ksytsAISEYlr4I2ntXhSQ4h\neeqOBYcSqEmyZO1UvIQm0T/dxXnyxGm1cmqlM8lm7Kmloys608dJrZ0YPwKBgQCq\n6mRZ9GoqEbmFRIUNSeNVaHbvQXWePD+AiH1j7wRIsGwqy/8QmcR9zw9DyFr39V0W\n+LH2hIcwvXkZAjygs/r3EWVK0X9JYt12Q01NqZNYtZzcfzq2P0f1K7pz0Km0cMYe\n567Wt7kY4OIl1XOM+8d3iCEch4S9dJKAuV+xy+LyNQKBgQCzMFSR3rL2TJnVjjpF\n9vEcj9vp6REEO8DVUVCzkM0WrWUNuRpps2/aqwBLTjDHGq2LhiUk+y/viYJpVeT5\nBFX4X7I7IrD5WOr1FT0Gt/gXupFZddeimjAjz3oUFV0k3QUrBF59oQ4nJOAns/g3\nOoFIno2fjel96YCImswJuK2elQ==\n-----END PRIVATE KEY-----\n";

privateKey = "-----BEGIN RSA PRIVATE KEY-----MIIEpAIBAAKCAQEAp2QUkEBniVVPe9u/IsdaXYvu1N/Vj8ZmLo7bD/DH6NEDurixBq4UTmyiBOuUKTK98Q6Hc4Xf1P43iZVgT4KEFQjcmX4VHypNkaU9me8josvu7Qzs2yI0zpWm5nPof4lT90omglyXTHdpw/YJZn/DjURrzcq9B+QiFhwddC5Vp+/OzUTeLjtxGNvZCFuvWQH8tqwLCqikqUITPOL9qiOh16Daaqfic2FB/X2GofYfBfZCWSqkpOdhcDBrvG1kXJZWLCSMOhuzg8aQe5QCYXRk9ElwQirwIueZyHxb53U+G9W9odVN4riGmWdqE92yVprgAp2CMbt62W4z64UEInQPwwIDAQABAoIBAEQ57oe9OHYpZ3Q8ZPNv/c0TNA1gDlPDsfJYF8GvikvCpZp9nOn0GiK89Gy8+G6yV+jg2ySi9FCELW7Oi6rcr6lDK2cElOdW/rbWev07E3NPW9sS4ZePoaZyKMzVgXY6KxcoCfoocyKfqWRN7BbzDGmP8cC3WcTVn28Tlo28NP11gC5aiAG2KZOshU4rJmkdY1ufMaScrk7XywNJii13Y7W5L4KfueC3QvQEzSXtX3/nV25szYX2ToaG8IeIsm2O/cZaVkZORz9nGOM3Ap/YmusKm5l9QCaWr1GrSMtusfbXlzTA7m4gDDjMTsk3gnDpOQNHYImFOk99561V6nCvpIECgYEA1H1ib93LaXFay16eWB4ya/mtHX/yzORoJOBOhUgT7CLIHd4LH+3s29Y3W6xYKAMVoZWq17HHPHzsEheBhXq+SrxGORECy0GThxuleu3JQkQtkJ6ULe0wfmFUOcod7rWUaAf1iFWEZyUwF+egp/8u+AaIhNoFgzrnIdrel2Rzd9sCgYEAyaqiqE/+wd4I03Hrc7XApgrxxFVw44rUn4QFbc/p+h+ZvZYMzsjCfYGX4vDDQEHB92v6gsidJkizh7zA/lVfGsve+HREP8LKTZasxGpIqkgXhDWi7vK3lk0QazFu8wk9cWP5WU2VFmYakufdjTZrHv2I9El4v4dLbfX9+9I5IDkCgYBJh1HG0AMRa641bXpxl5FvF6i16o6EJA19pTjGmhh6v9Zrr2g+FkC+GbRyPoMK5XZYwceqd9QvtDKkWAnzvHOYvOm32ZET8I8yU3jBvwLDsX/q6VTxR4BeWyOgE7aj4aWHEin+kUkNwCqSOw6203DXVrtq7V62+Gz+pBQeYx4pvQKBgQCm1ueIzd2a8CFnJSlA6k3+ULGh13n0lefALI39QnR1PO2JPnlMHiVhhfRtiPhP0dcx5gAzcNsqUB1PH+aew2xSE/ZcoHvSMEoEFLLMMI37anciJumsO9uMmicKN7RtluhhRe+FZT0BcelsPi055ZqL4f8K8znVYo4R4+CDFHG0aQKBgQCmNoPUBq85EcnWHuzhnW2GKiFwmsuUkSEEDu7cyR6rRbujEUUjmrhPIUUlJSCUanXODjsto/Zq1D0rdAqpA4snOd+PVi/EeIxgYPqTni250f9XnHBOywbHUI0VWufECXjNFagwiEZYDObXvuLNyrzHcs6dWVe4TbwsFXvlLrpehQ==-----END RSA PRIVATE KEY-----";

// privateKey = privateKey.replace('-----BEGIN RSA PRIVATE KEY-----', '').replace('-----END RSA PRIVATE KEY-----', '')

// 要签名的内容字符串
const content = "Hello, World!";

// 创建签名对象
const sign = crypto.createSign("RSA-SHA256");

// 更新要签名的内容
sign.update(content);

// 使用私钥对内容进行签名
const signature = sign.sign(privateKey, 'base64');

console.log("Signature:", signature);
