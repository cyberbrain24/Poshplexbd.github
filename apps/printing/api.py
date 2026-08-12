"""
Printing Queue API
==================
Provides endpoints for:
  1. PrintingFile CRUD  (/printing/files/*)
  2. PreparedPrintList CRUD  (/printing/lists/*)
  3. PDF generation  (/printing/lists/{id}/pdf)
  4. Order-items helper for the Prepare Print workflow (/printing/order-items)

All write endpoints require admin authentication (BearerAuth).

Upload pattern: images are uploaded via dedicated POST endpoints, metadata via JSON.
This avoids the PUT multipart limitation in django-ninja without the files middleware.
"""

from __future__ import annotations

import io
import os
from typing import Any, List, Optional

from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Router, Schema
from ninja.errors import HttpError
from ninja.files import UploadedFile
from ninja import File

from apps.core.api import BearerAuth, enforce_permission
from apps.printing.models import PreparedPrintItem, PreparedPrintList, PrintingFile

router = Router()


# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────

class PrintingFileCreateSchema(Schema):
    """Metadata-only schema for creating/updating a printing file (no images)."""
    name: str
    product_id: int
    design_file_1_width_mm: Optional[int] = 0
    design_file_1_height_mm: Optional[int] = 0
    design_file_2_width_mm: Optional[int] = None
    design_file_2_height_mm: Optional[int] = None
    additional_notes: Optional[str] = ""


class PrintingFileResponseSchema(Schema):
    id: int
    name: str
    product_id: int
    product_name: str
    design_file_1_url: Optional[str] = None
    design_file_1_width_mm: int
    design_file_1_height_mm: int
    design_file_2_url: Optional[str] = None
    design_file_2_width_mm: Optional[int] = None
    design_file_2_height_mm: Optional[int] = None
    additional_notes: str
    created_at: Any
    updated_at: Any


class PreparedPrintItemInputSchema(Schema):
    printing_file_id: int
    quantity: int
    order_number: Optional[str] = ""


class PreparedPrintItemResponseSchema(Schema):
    id: int
    printing_file_id: int
    printing_file_name: str
    product_name: str
    design_file_1_url: Optional[str] = None
    design_file_1_width_mm: int
    design_file_1_height_mm: int
    design_file_2_url: Optional[str] = None
    design_file_2_width_mm: Optional[int] = None
    design_file_2_height_mm: Optional[int] = None
    quantity: int
    order_number: str


class PreparedPrintListInputSchema(Schema):
    name: Optional[str] = ""
    notes: Optional[str] = ""
    items: List[PreparedPrintItemInputSchema]


class PreparedPrintListResponseSchema(Schema):
    id: int
    name: str
    notes: str
    total_items: int
    total_quantity: int
    created_at: Any
    updated_at: Any
    items: List[PreparedPrintItemResponseSchema]


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _file_url(file_field) -> Optional[str]:
    """Resolve a FileField to an absolute URL suitable for the frontend."""
    if not file_field:
        return None
    try:
        url = file_field.url
    except Exception:
        return None
    if url and not url.startswith("http"):
        base = os.environ.get("SITE_BASE_URL", "http://localhost:8000")
        url = f"{base.rstrip('/')}{url}"
    return url


def _serialize_printing_file(pf: PrintingFile) -> dict:
    return {
        "id": pf.id,
        "name": pf.name,
        "product_id": pf.product_id,
        "product_name": pf.product.name,
        "design_file_1_url": _file_url(pf.design_file_1),
        "design_file_1_width_mm": pf.design_file_1_width_mm,
        "design_file_1_height_mm": pf.design_file_1_height_mm,
        "design_file_2_url": _file_url(pf.design_file_2),
        "design_file_2_width_mm": pf.design_file_2_width_mm,
        "design_file_2_height_mm": pf.design_file_2_height_mm,
        "additional_notes": pf.additional_notes,
        "created_at": pf.created_at,
        "updated_at": pf.updated_at,
    }


def _serialize_item(item: PreparedPrintItem) -> dict:
    pf = item.printing_file
    return {
        "id": item.id,
        "printing_file_id": pf.id,
        "printing_file_name": pf.name,
        "product_name": pf.product.name,
        "design_file_1_url": _file_url(pf.design_file_1),
        "design_file_1_width_mm": pf.design_file_1_width_mm,
        "design_file_1_height_mm": pf.design_file_1_height_mm,
        "design_file_2_url": _file_url(pf.design_file_2),
        "design_file_2_width_mm": pf.design_file_2_width_mm,
        "design_file_2_height_mm": pf.design_file_2_height_mm,
        "quantity": item.quantity,
        "order_number": item.order_number,
    }


def _serialize_list(pl: PreparedPrintList) -> dict:
    items = pl.items.select_related('printing_file', 'printing_file__product').all()
    return {
        "id": pl.id,
        "name": pl.name,
        "notes": pl.notes,
        "total_items": items.count(),
        "total_quantity": sum(i.quantity for i in items),
        "created_at": pl.created_at,
        "updated_at": pl.updated_at,
        "items": [_serialize_item(i) for i in items],
    }


# ─────────────────────────────────────────────────────────────────────────────
# PrintingFile Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/files", response=List[PrintingFileResponseSchema], auth=BearerAuth())
def list_printing_files(
    request,
    search: Optional[str] = None,
    product_id: Optional[int] = None,
):
    """List all printing files with optional search and product filter."""
    enforce_permission(request, "catalog", "view_catalog")
    qs = PrintingFile.objects.select_related('product').all()
    if search:
        qs = qs.filter(
            Q(name__icontains=search) | Q(product__name__icontains=search)
        )
    if product_id:
        qs = qs.filter(product_id=product_id)
    return [_serialize_printing_file(pf) for pf in qs]


@router.post("/files/upload", response=PrintingFileResponseSchema, auth=BearerAuth())
def create_printing_file(
    request,
    name: str,
    product_id: int,
    design_file_1_width_mm: int = 0,
    design_file_1_height_mm: int = 0,
    design_file_2_width_mm: Optional[int] = None,
    design_file_2_height_mm: Optional[int] = None,
    additional_notes: str = "",
    design_file_1: UploadedFile = File(...),
    design_file_2: Optional[UploadedFile] = File(None),
):
    """Create a new printing file with images via multipart POST."""
    enforce_permission(request, "catalog", "edit_catalog")
    from django.apps import apps
    Product = apps.get_model('catalog', 'Product')
    product = get_object_or_404(Product, id=product_id)
    try:
        pf = PrintingFile(
            name=name,
            product=product,
            design_file_1_width_mm=design_file_1_width_mm,
            design_file_1_height_mm=design_file_1_height_mm,
            design_file_2_width_mm=design_file_2_width_mm,
            design_file_2_height_mm=design_file_2_height_mm,
            additional_notes=additional_notes,
        )
        pf.design_file_1 = design_file_1
        if design_file_2:
            pf.design_file_2 = design_file_2
        pf.save()
        return _serialize_printing_file(pf)
    except Exception as e:
        raise HttpError(400, str(e))


@router.post("/files/{file_id}/update-meta", response=PrintingFileResponseSchema, auth=BearerAuth())
def update_printing_file_meta(request, file_id: int, data: PrintingFileCreateSchema):
    """Update printing file metadata (name, product, dimensions, notes) via JSON."""
    enforce_permission(request, "catalog", "edit_catalog")
    pf = get_object_or_404(PrintingFile, id=file_id)
    from django.apps import apps
    Product = apps.get_model('catalog', 'Product')
    product = get_object_or_404(Product, id=data.product_id)
    try:
        pf.name = data.name
        pf.product = product
        pf.design_file_1_width_mm = data.design_file_1_width_mm or 0
        pf.design_file_1_height_mm = data.design_file_1_height_mm or 0
        pf.design_file_2_width_mm = data.design_file_2_width_mm
        pf.design_file_2_height_mm = data.design_file_2_height_mm
        pf.additional_notes = data.additional_notes or ""
        pf.save()
        return _serialize_printing_file(pf)
    except Exception as e:
        raise HttpError(400, str(e))


@router.post("/files/{file_id}/upload-design1", response=PrintingFileResponseSchema, auth=BearerAuth())
def upload_design_file_1(
    request,
    file_id: int,
    design_file_1: UploadedFile = File(...),
):
    """Replace design file 1 image for an existing printing file."""
    enforce_permission(request, "catalog", "edit_catalog")
    pf = get_object_or_404(PrintingFile, id=file_id)
    try:
        if pf.design_file_1:
            pf.design_file_1.delete(save=False)
        pf.design_file_1 = design_file_1
        pf.save()
        return _serialize_printing_file(pf)
    except Exception as e:
        raise HttpError(400, str(e))


@router.post("/files/{file_id}/upload-design2", response=PrintingFileResponseSchema, auth=BearerAuth())
def upload_design_file_2(
    request,
    file_id: int,
    design_file_2: UploadedFile = File(...),
):
    """Replace (or add) design file 2 image for an existing printing file."""
    enforce_permission(request, "catalog", "edit_catalog")
    pf = get_object_or_404(PrintingFile, id=file_id)
    try:
        if pf.design_file_2:
            pf.design_file_2.delete(save=False)
        pf.design_file_2 = design_file_2
        pf.save()
        return _serialize_printing_file(pf)
    except Exception as e:
        raise HttpError(400, str(e))


@router.delete("/files/{file_id}", auth=BearerAuth())
def delete_printing_file(request, file_id: int):
    """Delete a printing file. Blocked if referenced in any saved print list."""
    enforce_permission(request, "catalog", "edit_catalog")
    pf = get_object_or_404(PrintingFile, id=file_id)
    if PreparedPrintItem.objects.filter(printing_file=pf).exists():
        raise HttpError(
            400,
            "Cannot delete: this printing file is referenced in one or more saved print lists. "
            "Remove it from those lists first."
        )
    try:
        if pf.design_file_1:
            pf.design_file_1.delete(save=False)
        if pf.design_file_2:
            pf.design_file_2.delete(save=False)
        pf.delete()
        return {"success": True}
    except Exception as e:
        raise HttpError(400, str(e))


# ─────────────────────────────────────────────────────────────────────────────
# PreparedPrintList Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/lists", response=List[PreparedPrintListResponseSchema], auth=BearerAuth())
def list_prepared_print_lists(request):
    """List all saved prepared print lists."""
    enforce_permission(request, "catalog", "view_catalog")
    qs = PreparedPrintList.objects.prefetch_related(
        'items', 'items__printing_file', 'items__printing_file__product'
    ).all()
    return [_serialize_list(pl) for pl in qs]


@router.post("/lists", response=PreparedPrintListResponseSchema, auth=BearerAuth())
def create_prepared_print_list(request, data: PreparedPrintListInputSchema):
    """Save a new prepared print list batch."""
    enforce_permission(request, "catalog", "edit_catalog")
    try:
        with transaction.atomic():
            name = data.name or timezone.now().strftime("%Y-%m-%d %H:%M:%S")
            pl = PreparedPrintList.objects.create(name=name, notes=data.notes or "")
            for item_data in data.items:
                pf = get_object_or_404(PrintingFile, id=item_data.printing_file_id)
                PreparedPrintItem.objects.create(
                    prepared_list=pl,
                    printing_file=pf,
                    quantity=max(1, item_data.quantity),
                    order_number=item_data.order_number or "",
                )
            return _serialize_list(pl)
    except Exception as e:
        raise HttpError(400, str(e))


@router.put("/lists/{list_id}", response=PreparedPrintListResponseSchema, auth=BearerAuth())
def update_prepared_print_list(request, list_id: int, data: PreparedPrintListInputSchema):
    """Edit a saved print list — replaces all items atomically."""
    enforce_permission(request, "catalog", "edit_catalog")
    pl = get_object_or_404(PreparedPrintList, id=list_id)
    try:
        with transaction.atomic():
            if data.name:
                pl.name = data.name
            pl.notes = data.notes or ""
            pl.save()
            pl.items.all().delete()
            for item_data in data.items:
                pf = get_object_or_404(PrintingFile, id=item_data.printing_file_id)
                PreparedPrintItem.objects.create(
                    prepared_list=pl,
                    printing_file=pf,
                    quantity=max(1, item_data.quantity),
                    order_number=item_data.order_number or "",
                )
            return _serialize_list(pl)
    except Exception as e:
        raise HttpError(400, str(e))


@router.delete("/lists/{list_id}", auth=BearerAuth())
def delete_prepared_print_list(request, list_id: int):
    """Delete a prepared print list and all its items."""
    enforce_permission(request, "catalog", "edit_catalog")
    pl = get_object_or_404(PreparedPrintList, id=list_id)
    pl.delete()
    return {"success": True}


# ─────────────────────────────────────────────────────────────────────────────
# PDF Generation
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/lists/{list_id}/pdf", auth=BearerAuth())
def download_print_list_pdf(request, list_id: int):
    """
    Generate and return a PDF print instruction sheet for a saved print list.
    PDF includes: list name, date, and for each item: design images embedded inline,
    file name, product name, quantity, and width × height spec in mm.
    """
    enforce_permission(request, "catalog", "view_catalog")
    pl = get_object_or_404(
        PreparedPrintList.objects.prefetch_related(
            'items', 'items__printing_file', 'items__printing_file__product'
        ),
        id=list_id
    )

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib import colors
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table,
            TableStyle, Image as RLImage, HRFlowable
        )
        from reportlab.lib.enums import TA_CENTER
    except ImportError:
        raise HttpError(500, "reportlab is not installed. Run: pip install reportlab")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=20 * mm,
        bottomMargin=15 * mm,
        title=f"Print List – {pl.name}",
    )

    style_title = ParagraphStyle('title', fontSize=18, fontName='Helvetica-Bold',
                                 spaceAfter=4, alignment=TA_CENTER)
    style_subtitle = ParagraphStyle('subtitle', fontSize=9, fontName='Helvetica',
                                    textColor=colors.grey, spaceAfter=12, alignment=TA_CENTER)
    style_section = ParagraphStyle('section', fontSize=13, fontName='Helvetica-Bold',
                                   spaceAfter=4, spaceBefore=14)
    style_body = ParagraphStyle('body', fontSize=9, fontName='Helvetica', spaceAfter=2)
    style_spec = ParagraphStyle('spec', fontSize=8, fontName='Helvetica',
                                textColor=colors.HexColor('#555555'), spaceAfter=2)
    style_imglab = ParagraphStyle('imglab', fontSize=8, fontName='Helvetica-Bold')
    style_imgspec = ParagraphStyle('imgspec', fontSize=8, fontName='Helvetica',
                                   textColor=colors.HexColor('#c0392b'))

    story = []

    items_qs = pl.items.select_related('printing_file', 'printing_file__product').all()
    total_qty = sum(i.quantity for i in items_qs)

    story.append(Paragraph("POSHPLEX — PRINTING INSTRUCTION SHEET", style_title))
    story.append(Paragraph(
        f"List: {pl.name}  |  Generated: {timezone.now().strftime('%Y-%m-%d %H:%M')}  |  "
        f"Items: {items_qs.count()}  |  Total Qty: {total_qty}",
        style_subtitle
    ))
    story.append(HRFlowable(width="100%", thickness=1,
                             color=colors.HexColor('#222222'), spaceAfter=10))

    media_root = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        'media'
    )

    def _build_image_cell(file_field, width_mm, height_mm, label):
        cell = []
        if file_field:
            try:
                img_path = os.path.join(media_root, str(file_field))
                if os.path.exists(img_path):
                    img = RLImage(img_path, width=75 * mm, height=75 * mm, kind='proportional')
                    cell.append(img)
                else:
                    cell.append(Paragraph("[Image file not found]", style_spec))
            except Exception:
                cell.append(Paragraph("[Could not load image]", style_spec))
        else:
            cell.append(Paragraph("[No image]", style_spec))

        cell.append(Spacer(1, 2 * mm))
        cell.append(Paragraph(label, style_imglab))
        if width_mm and height_mm:
            cell.append(Paragraph(f"Size: {width_mm} mm × {height_mm} mm", style_imgspec))
        return cell

    for idx, item in enumerate(items_qs, start=1):
        pf = item.printing_file
        story.append(Paragraph(f"{idx}. {pf.name}", style_section))
        story.append(Paragraph(f"Product: {pf.product.name}", style_body))
        story.append(Paragraph(f"Quantity to Print: <b>{item.quantity}</b>", style_body))
        if item.order_number:
            story.append(Paragraph(f"Source Order: {item.order_number}", style_spec))
        if pf.additional_notes:
            story.append(Paragraph(f"Notes: {pf.additional_notes}", style_spec))
        story.append(Spacer(1, 4 * mm))

        file1_cell = _build_image_cell(
            pf.design_file_1, pf.design_file_1_width_mm, pf.design_file_1_height_mm, "Design File 1"
        )
        if pf.design_file_2:
            file2_cell = _build_image_cell(
                pf.design_file_2, pf.design_file_2_width_mm, pf.design_file_2_height_mm, "Design File 2"
            )
        else:
            file2_cell = [Paragraph("—  (No second design)", style_spec)]

        img_table = Table(
            [[file1_cell, file2_cell]],
            colWidths=[90 * mm, 90 * mm],
        )
        img_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f9f9f9')),
        ]))
        story.append(img_table)
        story.append(Spacer(1, 6 * mm))
        story.append(HRFlowable(width="100%", thickness=0.5,
                                color=colors.HexColor('#dddddd'), spaceAfter=6))

    doc.build(story)
    buffer.seek(0)

    response = HttpResponse(buffer.read(), content_type='application/pdf')
    safe_name = pl.name.replace(' ', '_').replace(':', '-')
    response['Content-Disposition'] = f'attachment; filename="print_list_{safe_name}.pdf"'
    return response


# ─────────────────────────────────────────────────────────────────────────────
# Order-Items Helper (for Prepare Print workflow)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/order-items", auth=BearerAuth())
def get_order_items_for_printing(
    request,
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    """
    Fetch order items with their associated printing files.
    Used by the Prepare Print tab to populate the quantity-edit table.

    Filters:
      - status: order status (placed, review, pending, cancelled, delivered, etc.)
      - search: searches by order_number or product name
    """
    enforce_permission(request, "catalog", "view_catalog")
    from django.apps import apps
    Order = apps.get_model('orders', 'Order')
    OrderItem = apps.get_model('orders', 'OrderItem')
    Product = apps.get_model('catalog', 'Product')

    order_qs = Order.objects.all()
    if status:
        order_qs = order_qs.filter(status=status)
    if search:
        order_qs = order_qs.filter(order_number__icontains=search)

    order_item_qs = OrderItem.objects.filter(order__in=order_qs).select_related('order')

    results = []
    seen_pf_ids: set = set()

    for oi in order_item_qs:
        product = None
        try:
            from apps.catalog.models import ProductVariant
            variant = ProductVariant.objects.filter(sku=oi.sku).select_related('product').first()
            if variant:
                product = variant.product
            else:
                product = Product.objects.filter(sku=oi.sku).first()
        except Exception:
            pass

        if not product:
            continue

        pf_qs = PrintingFile.objects.filter(product=product)
        if search:
            pf_qs = pf_qs.filter(
                Q(name__icontains=search) | Q(product__name__icontains=search)
            )

        for pf in pf_qs:
            key = (oi.order.order_number or str(oi.order.id), pf.id)
            if key in seen_pf_ids:
                continue
            seen_pf_ids.add(key)

            results.append({
                "order_number": oi.order.order_number or str(oi.order.id),
                "order_status": oi.order.status,
                "sku": oi.sku,
                "order_quantity": oi.quantity,
                "printing_file_id": pf.id,
                "printing_file_name": pf.name,
                "product_id": product.id,
                "product_name": product.name,
                "design_file_1_url": _file_url(pf.design_file_1),
                "design_file_1_width_mm": pf.design_file_1_width_mm,
                "design_file_1_height_mm": pf.design_file_1_height_mm,
                "design_file_2_url": _file_url(pf.design_file_2),
                "design_file_2_width_mm": pf.design_file_2_width_mm,
                "design_file_2_height_mm": pf.design_file_2_height_mm,
                "suggested_quantity": oi.quantity,
            })

    return results
