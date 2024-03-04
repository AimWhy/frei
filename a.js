const crypto = require("crypto");

// 读取加密后的文件
let key1 =
  "YKKm6l/wBSs6M08BIhYvyPZd+uNPRHAacwyAGigS3Ea1M2HORKjTPnO0KjT3tdwfbcak3DnG43EgXrz+iKvHzfbCGIzbtf6SRrhFFxJiVBUQ8oyc6bjIHbehx08i6DMuQjuyG5dSLSBe5SkevsUjVVUhotv+Om/Ps7eQDSqYGiATDpSZq0jtAZGDUHCTChRpMku3Jsmwj+lqg9XsQcFiYjVsKwwgO9sXwwJXOdSbTEl3lZV8dfpf9UXup9FBjNO8DcKOc4VZrfdoA5qZWj5tCLyNttcHeRSmc7lyqtAODf6ImAvDw38Bp9S5rPScLyTwKRfZVw2+elDlij78HWcbqZMhRFe844T0HvTumf0LUVMZcjxpKpRrITMJdEE9OzZaccAJw0EiACqaTS7gigB3QMUPf0JAiUttdkKW6zpCiAwE55HUb+F9MqaRULRG14KChyq+onwySbV4yGsc/Kt1yGRUtYrpATLEtqvpXWpBxP8MXG45yboyEbijx3vNYzY16WkimLmb1IYrEmBQyzFUdGOi8s1X/y8yFEJJfg1qj1dVh5L743zK1HphLqY6s9jZzW1pU5Bw0D7pl61Hwmu/TqWYp03aI7PxPFLbT049IZpqwmkYnK/taefQR6vyBot1HSU4wXljJ0h0TYTE/TM4/7N0AOvQjNKL/33L4sBr0I4b8C39N3u9b7psUCC9JhI6ZQHmN6RFe4xcHakHkvpkRW6KsM3wrQR8Kg97XD/b0EQkVjHtDUZhLf4YShWIdgtJZMQPB3Klq6ttnHQN3XCozqDQMgrqX7jweVrKJUZNPzlwC8/UUJevpoCC7wHksnPDHaCTcBjFt6KBpRZ85Yp98h4F9iALCylrbqbvY+lSum2Bp4gATL+bx7wVQCGEq8LaDCZ/vATwwp+je9V2VOWCPDXubmZLlqnyOnhHpD0hFoXxBpyVhq3/Uc6uFAYSfKsDSl7Ut+rEOUt5vjEKucL+MDWbdAFT9M5i5YceFNf/d+6AlFn03GPji1w49g3n9ralnRshRaRnJtagp9TPBTZt6ZNc1RhpEY6khn526xxhoqn/qV368aD1rucpCMe4RPk/z2R8SZjiVqBrEKdCE+T5hGcy+8dKUTCas8esDRqO+2pD0h505LL5VapGfr7MpqpilToyTbZVRJEawhHJushcdihy1eVgzcEVhEp9x6EU0baLSh60EM1TkatOqgi9dwCi8VNKO/HlTMNOEj4dC7GAIe+Pdj46EhObJvaiZQ42UiWgXiS/PqzE6f1gzZrAkyu8pICfs5N+2xWtURzZ9BjkdFDBQExsbS+fwKIxcsr9mKshe0X35IXpw1Qt3Ymv76AVClhq9LRBh/rHG1tvAmlFLkVFyp2nTOnlDawX8WzuiawbwpgZ4/L8kLzGhFbsPdT/x9TO9+Sb/XtpSkSczr6K+PTVGm8L5KQkb8W3BW2sssWC75ltFQiZe7FmaL07iUzYW3YMH7+Y91xhbxl54lUu96W4xzIoIVC82cv9mBd9e8AKM+Y4+C/Pvy/kbptz8B5gndsmb6qFLbdrO3mtzV5P/KFskUvUxeNmPlVAW5uSkC7pxyilSTACdYfzCSGNFQeraUcYYdMgul89Rbtr0jJzfknAHi2ePgkcHlkPhcs+l5DWZQ0Ti9fNoszWPaWVlfZME5n0VT6cC9xLznCSl5rz3S9bqYA/MxrYqAyQLSIDqqc=";
let key2 =
  "mHSeXCIsMn7nMMRZqy0D/YW1xB8i/OhXII292FIcCLlcCACT0IHJ8Ou0miQy5TGuuhrJMTcNKwYxQJ/tFYl1a2iBF2fuO+h3aP/RCLocbPDIXuKwoC0N/0PZ9hI0SppwR4lVFFfk8UkoV8SPa1Xj3jIdeqeR/Bgc9qQXxUmNrS+hpErTpMkbfSh5qOMjgEnAaak4TKdmSdbIEBmQqbY27IVlHlbkxlmAAxD5LJ44WsOlVRtzqhUEcRpJN5Aj7FQ/akBzvRmjrxM1Ej6BPmDbOsn7QnhAmktsgu3DxUXaMQjquW460tl0JuLfJrsuZbZMkR91JV0ypGryXORslllEsg==";

let privateKey =
  "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAp2QUkEBniVVPe9u/IsdaXYvu1N/Vj8ZmLo7bD/DH6NEDurixBq4UTmyiBOuUKTK98Q6Hc4Xf1P43iZVgT4KEFQjcmX4VHypNkaU9me8josvu7Qzs2yI0zpWm5nPof4lT90omglyXTHdpw/YJZn/DjURrzcq9B+QiFhwddC5Vp+/OzUTeLjtxGNvZCFuvWQH8tqwLCqikqUITPOL9qiOh16Daaqfic2FB/X2GofYfBfZCWSqkpOdhcDBrvG1kXJZWLCSMOhuzg8aQe5QCYXRk9ElwQirwIueZyHxb53U+G9W9odVN4riGmWdqE92yVprgAp2CMbt62W4z64UEInQPwwIDAQABAoIBAEQ57oe9OHYpZ3Q8ZPNv/c0TNA1gDlPDsfJYF8GvikvCpZp9nOn0GiK89Gy8+G6yV+jg2ySi9FCELW7Oi6rcr6lDK2cElOdW/rbWev07E3NPW9sS4ZePoaZyKMzVgXY6KxcoCfoocyKfqWRN7BbzDGmP8cC3WcTVn28Tlo28NP11gC5aiAG2KZOshU4rJmkdY1ufMaScrk7XywNJii13Y7W5L4KfueC3QvQEzSXtX3/nV25szYX2ToaG8IeIsm2O/cZaVkZORz9nGOM3Ap/YmusKm5l9QCaWr1GrSMtusfbXlzTA7m4gDDjMTsk3gnDpOQNHYImFOk99561V6nCvpIECgYEA1H1ib93LaXFay16eWB4ya/mtHX/yzORoJOBOhUgT7CLIHd4LH+3s29Y3W6xYKAMVoZWq17HHPHzsEheBhXq+SrxGORECy0GThxuleu3JQkQtkJ6ULe0wfmFUOcod7rWUaAf1iFWEZyUwF+egp/8u+AaIhNoFgzrnIdrel2Rzd9sCgYEAyaqiqE/+wd4I03Hrc7XApgrxxFVw44rUn4QFbc/p+h+ZvZYMzsjCfYGX4vDDQEHB92v6gsidJkizh7zA/lVfGsve+HREP8LKTZasxGpIqkgXhDWi7vK3lk0QazFu8wk9cWP5WU2VFmYakufdjTZrHv2I9El4v4dLbfX9+9I5IDkCgYBJh1HG0AMRa641bXpxl5FvF6i16o6EJA19pTjGmhh6v9Zrr2g+FkC+GbRyPoMK5XZYwceqd9QvtDKkWAnzvHOYvOm32ZET8I8yU3jBvwLDsX/q6VTxR4BeWyOgE7aj4aWHEin+kUkNwCqSOw6203DXVrtq7V62+Gz+pBQeYx4pvQKBgQCm1ueIzd2a8CFnJSlA6k3+ULGh13n0lefALI39QnR1PO2JPnlMHiVhhfRtiPhP0dcx5gAzcNsqUB1PH+aew2xSE/ZcoHvSMEoEFLLMMI37anciJumsO9uMmicKN7RtluhhRe+FZT0BcelsPi055ZqL4f8K8znVYo4R4+CDFHG0aQKBgQCmNoPUBq85EcnWHuzhnW2GKiFwmsuUkSEEDu7cyR6rRbujEUUjmrhPIUUlJSCUanXODjsto/Zq1D0rdAqpA4snOd+PVi/EeIxgYPqTni250f9XnHBOywbHUI0VWufECXjNFagwiEZYDObXvuLNyrzHcs6dWVe4TbwsFXvlLrpehQ==\n-----END RSA PRIVATE KEY-----";

privateKey = privateKey.replace(
  /\s*(-+([^-]+)-+)\s*/g,
  (_, comment) => `\n${comment}\n`
);

let MAX_DECRYPT_BLOCK = 256;

let result1 =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJ1cG4iOiJ0ZXN0dXNlciIsImlzcyI6ImF1dGguYW8uc3BhY2UiLCJpYXQiOjE3MDcyODUxODcsImV4cCI6MzQxNDY1Njc3NCwiaW5mbyI6InhUVWdjRHRsY08zSTZSVFNid0pNS0hsMCtCQUt1dWpaTUh4aExIWU14ZmRmL3p6b3YrbnJVbXhyOUlpQkphWEFuNDdmYjZBRjhJNjJVSHh0L0VxR2NOeVByMzFHZll6ZGtwOHpnZW9Sajg1Sng0b2s0dGI0M1d2dTFhWjNGZnp5ZGY0bGV0Y09zdU1vdFhSV3VyNm5iRWNRVjAxSkNWTkc4OTNTNWcwb29Ha2o5YUxtc2tTYk4wK09mY0dTL1owYW1iRWUzclZiSTVHTmEyZUMwMy9UajB3Sm95Y3NyMTFPNXpIQ3J1eE0rUk9PSUdZd09EZ3pPa3NKMXdiRjJYNjd3SGdXWFNoRnJxYWpiNTJ4NWtHb1RsRHNuRU5CbElNazAxTHViVWFocXV4S2ZWOC9lN3RIVzFkNlphZ3g5WUp5dHN6TnMwYzVjWXMrNW9scVcwSWp5dz09Iiwic2hhcmVkSW5pdGlhbGl6YXRpb25WZWN0b3IiOiJoVTdCdFhZSkJ0SFV2b0h6TzBXRXBnPT0iLCJ0b2tlblR5cGUiOiJhY2Nlc3MiLCJqdGkiOiI1MDVlNjAyOS04MzdiLTQ0MmMtODI1ZS0yNGRjZGIzOTM1NzMifQ.vRSM-D4yY5DAoQeoKcGy9gea4nJ3mnIh7uoyIdyL5OeTNyQl4KL-EWKth-tJgUD1MsC0Wpbi1MarhbJJ33CAgMEAAnqVP0mQMjsHkLU4lEC5K0gJu8HHKhYdVvIbvy2_HYs1Ar3rO-T5F_jmdSB0HsySa3L1RwFv46HnbOKv9Efs_7NB6pQbJ1WaD318aKQ8T8WvBr2mctfdLY6XGXEAanrP1reJnj6bt3fay8m6ImoEjKUyXfc41Z9iAJ9kBLPIwFEl593Ur24XR1fvvotgDQovLjQf9q4as0crhtGRal1eUCci-XXEJVM8jVeBEJCsxneqIhYj6oIiu95xkDzZ5w==";
let result2 = "231390b0-300f-4be5-8e8e-d70dc03064e4";

let result22 = crypto.privateDecrypt(
  {
    key: privateKey,
    // 在这里，你可以指定padding（如果你在加密时使用了非默认的padding）
    padding: crypto.constants.RSA_PKCS1_PADDING,
  },
  Buffer.from(key2, "base64")
);

let x = result22.toString("utf8");

// 使用私钥分块解密
const decryptedData = decryptWithPrivateKey(
  Buffer.from(key1, "base64"),
  privateKey
);

// 将Buffer转换为字符串（假设原始数据是字符串）
const y = decryptedData.toString("utf8");

console.log(y === result1);
console.log(x === result2);

// 分块解密函数
function decryptWithPrivateKey(encryptedBuffer, privateKey) {
  let decryptedBuffer = Buffer.alloc(0); // 初始化一个空Buffer用于拼接解密后的数据
  const totalLength = encryptedBuffer.length;
  let offset = 0;

  while (offset < totalLength) {
    // 截取一块数据进行解密
    const block = encryptedBuffer.slice(
      offset,
      Math.min(offset + MAX_DECRYPT_BLOCK, totalLength)
    );
    const decryptedChunk = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      block
    );

    // 拼接解密后的数据
    decryptedBuffer = Buffer.concat([decryptedBuffer, decryptedChunk]);

    // 更新偏移量
    offset += MAX_DECRYPT_BLOCK;
  }

  return decryptedBuffer;
}
