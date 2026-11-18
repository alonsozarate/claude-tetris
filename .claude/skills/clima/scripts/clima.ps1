param(
    [string]$Ciudad = "",
    [double]$Lat,
    [double]$Lon
)

$ErrorActionPreference = "Stop"
$inv = [Globalization.CultureInfo]::InvariantCulture

# Codigos WMO del clima (Open-Meteo)
$codigos = @{
    0 = "Despejado"; 1 = "Mayormente despejado"; 2 = "Parcialmente nublado"; 3 = "Nublado"
    45 = "Niebla"; 48 = "Niebla con escarcha"
    51 = "Llovizna ligera"; 53 = "Llovizna moderada"; 55 = "Llovizna intensa"
    56 = "Llovizna helada ligera"; 57 = "Llovizna helada intensa"
    61 = "Lluvia ligera"; 63 = "Lluvia moderada"; 65 = "Lluvia intensa"
    66 = "Lluvia helada ligera"; 67 = "Lluvia helada intensa"
    71 = "Nevada ligera"; 73 = "Nevada moderada"; 75 = "Nevada intensa"; 77 = "Granos de nieve"
    80 = "Chubascos ligeros"; 81 = "Chubascos moderados"; 82 = "Chubascos violentos"
    85 = "Chubascos de nieve ligeros"; 86 = "Chubascos de nieve intensos"
    95 = "Tormenta"; 96 = "Tormenta con granizo ligero"; 99 = "Tormenta con granizo intenso"
}

# 1) Resolver ubicacion
if ($Ciudad) {
    $q = [uri]::EscapeDataString($Ciudad)
    $geo = Invoke-RestMethod -Uri "https://geocoding-api.open-meteo.com/v1/search?name=$q&count=1&language=es&format=json"
    if (-not $geo.results) { throw "No se encontro la ciudad: $Ciudad" }
    $r = $geo.results[0]
    $Lat = [double]$r.latitude
    $Lon = [double]$r.longitude
    $ubicacion = "$($r.name), $($r.admin1), $($r.country)"
} elseif (-not $PSBoundParameters.ContainsKey('Lat')) {
    # Sin ciudad ni coordenadas: ubicacion aproximada por IP (la de este equipo)
    $ip = Invoke-RestMethod -Uri "https://ipapi.co/json/"
    $Lat = [double]$ip.latitude
    $Lon = [double]$ip.longitude
    $ubicacion = "$($ip.city), $($ip.region), $($ip.country_name) (por IP)"
} else {
    $ubicacion = "lat $($Lat.ToString($inv)), lon $($Lon.ToString($inv))"
}

# 2) Clima actual
$latS = $Lat.ToString($inv)
$lonS = $Lon.ToString($inv)
$vars = "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m"
$url = "https://api.open-meteo.com/v1/forecast?latitude=$latS&longitude=$lonS&current=$vars&wind_speed_unit=kmh&timezone=auto"
$w = Invoke-RestMethod -Uri $url

$c = $w.current
$u = $w.current_units
$desc = $codigos[[int]$c.weather_code]
if (-not $desc) { $desc = "Codigo $($c.weather_code)" }

# 3) Salida
"Clima en $ubicacion"
"Hora local:     $($c.time) ($($w.timezone))"
"Condicion:      $desc"
"Temperatura:    $($c.temperature_2m) $($u.temperature_2m) (sensacion $($c.apparent_temperature) $($u.apparent_temperature))"
"Humedad:        $($c.relative_humidity_2m) $($u.relative_humidity_2m)"
"Viento:         $($c.wind_speed_10m) $($u.wind_speed_10m) (direccion $($c.wind_direction_10m) $($u.wind_direction_10m))"
"Precipitacion:  $($c.precipitation) $($u.precipitation)"
