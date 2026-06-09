# ============================================
# Cifrador compatible con app.js (AES-CBC-128)
# ============================================

$archivoEntrada  = "Manteniment.xlsx"
$archivoSalida   = "datos.b64"
$passwordRaw     = "Bernabeu_2026"

# 1. Clave: igual que JS -> padEnd(32) con espacios, luego UTF-8
$claveStr = $passwordRaw.PadRight(32).Substring(0, 32)
$claveBytes = [System.Text.Encoding]::UTF8.GetBytes($claveStr)

# 2. IV aleatorio de 16 bytes (compatible con PowerShell antiguo)
$iv = New-Object byte[] 16
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($iv)

# 3. Leer el Excel como bytes
$datosExcel = [System.IO.File]::ReadAllBytes($archivoEntrada)

# 4. Cifrar con AES-CBC + PKCS7
$aes = [System.Security.Cryptography.Aes]::Create()
$aes.Mode    = [System.Security.Cryptography.CipherMode]::CBC
$aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7
$aes.Key     = $claveBytes
$aes.IV      = $iv

$encryptor     = $aes.CreateEncryptor()
$datosCifrados = $encryptor.TransformFinalBlock($datosExcel, 0, $datosExcel.Length)

# 5. Combinar IV + datos cifrados y codificar en Base64 SIN saltos de linea
$resultado = New-Object byte[] ($iv.Length + $datosCifrados.Length)
[System.Buffer]::BlockCopy($iv,            0, $resultado, 0,           $iv.Length)
[System.Buffer]::BlockCopy($datosCifrados, 0, $resultado, $iv.Length,  $datosCifrados.Length)

$base64 = [Convert]::ToBase64String($resultado)
[System.IO.File]::WriteAllText($archivoSalida, $base64, [System.Text.Encoding]::ASCII)

Write-Host "Cifrado OK -> $archivoSalida"