import 'package:flutter/material.dart';
import 'i18n.dart';

/// Consistent, visible close control for every customer-facing modal dialog.
/// Dismissing a typed dialog without a result follows its existing cancel path.
Widget customerDialogTitle(BuildContext dialogContext, String title, {bool canClose = true}) {
  return Row(
    children: [
      Expanded(child: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis)),
      IconButton(
        tooltip: tr('Close', 'बंद करें'),
        icon: const Icon(Icons.close),
        onPressed: canClose ? () => Navigator.of(dialogContext).pop() : null,
      ),
    ],
  );
}
