from django.db import models


class PrintingFile(models.Model):
    """
    A design file template linked to a single product.
    Contains up to two design images with print-spec dimensions (in mm),
    plus free-form notes for the press operator.
    This model is the core catalogue of all printable artwork in the system.
    """
    objects = models.Manager()

    name = models.CharField(
        max_length=255,
        help_text="Human-readable name for this printing file, e.g. 'Skull Tee Front & Back'."
    )
    product = models.ForeignKey(
        'catalog.Product',
        on_delete=models.PROTECT,
        related_name='printing_files',
        help_text="The product this artwork belongs to."
    )

    # --- Design File 1 (required) ---
    design_file_1 = models.FileField(
        upload_to='printing_designs/',
        help_text="Primary design image. Any format (PNG, JPG, PDF, AI, etc.)."
    )
    design_file_1_width_mm = models.PositiveIntegerField(
        default=0,
        help_text="Print width of design file 1, in millimetres (mm)."
    )
    design_file_1_height_mm = models.PositiveIntegerField(
        default=0,
        help_text="Print height of design file 1, in millimetres (mm)."
    )

    # --- Design File 2 (optional) ---
    design_file_2 = models.FileField(
        upload_to='printing_designs/',
        blank=True, null=True,
        help_text="Optional secondary design image (e.g. back print, sleeve label)."
    )
    design_file_2_width_mm = models.PositiveIntegerField(
        blank=True, null=True,
        help_text="Print width of design file 2, in millimetres (mm)."
    )
    design_file_2_height_mm = models.PositiveIntegerField(
        blank=True, null=True,
        help_text="Print height of design file 2, in millimetres (mm)."
    )

    # --- Notes ---
    additional_notes = models.TextField(
        blank=True,
        default='',
        help_text="Free-form instructions for the press operator. Fabric type, colour codes, etc."
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Printing File'
        verbose_name_plural = 'Printing Files'

    def __str__(self):
        return f"{self.name} → {self.product.name}"


class PreparedPrintList(models.Model):
    """
    A named, saved batch of PrintingFile items with per-item print quantities.
    Auto-named with the creation timestamp for traceability.
    Can be downloaded as a PDF print instruction sheet.
    """
    objects = models.Manager()

    name = models.CharField(
        max_length=255,
        help_text="Auto-generated name: 'YYYY-MM-DD HH:MM:SS'. Editable by user."
    )
    notes = models.TextField(
        blank=True,
        default='',
        help_text="Optional batch-level notes (e.g. 'Rush job for Eid collection')."
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Prepared Print List'
        verbose_name_plural = 'Prepared Print Lists'

    def __str__(self):
        return self.name

    @property
    def total_items(self):
        return self.items.count()

    @property
    def total_quantity(self):
        return sum(item.quantity for item in self.items.all())


class PreparedPrintItem(models.Model):
    """
    A single line item within a PreparedPrintList.
    Links a PrintingFile with a specific print quantity.
    The order_number field is informational only — it references the source order
    but carries no FK dependency, keeping the printing module independent.
    """
    objects = models.Manager()

    prepared_list = models.ForeignKey(
        PreparedPrintList,
        on_delete=models.CASCADE,
        related_name='items'
    )
    printing_file = models.ForeignKey(
        PrintingFile,
        on_delete=models.PROTECT,
        related_name='print_items',
        help_text="The design/artwork to print."
    )
    quantity = models.PositiveIntegerField(
        default=1,
        help_text="Number of prints required for this design in this batch."
    )
    order_number = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Informational: source order reference. No FK — keeps module independent."
    )

    class Meta:
        ordering = ['id']
        verbose_name = 'Prepared Print Item'
        verbose_name_plural = 'Prepared Print Items'

    def __str__(self):
        return f"{self.quantity}× {self.printing_file.name} (List: {self.prepared_list.name})"
