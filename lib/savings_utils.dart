/// Monetary savings are server-calculated. Invalid or negative values never
/// generate a celebration or appear as a positive lifetime total.
double positiveSavings(Object? value) {
  final parsed = value is num ? value.toDouble() : double.tryParse('$value');
  if (parsed == null || !parsed.isFinite || parsed <= 0) return 0;
  return parsed;
}

/// No PIN is required for a locality served by Easy Mandi.
bool validOptionalPin(String input) {
  final pin = input.trim();
  return pin.isEmpty || RegExp(r'^[1-9][0-9]{5}$').hasMatch(pin);
}
