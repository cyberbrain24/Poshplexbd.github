import React, { useState, useEffect } from "react";
import {
  Tabs, Table, Button, Modal, Form, Input, InputNumber, Select, Tree, 
  Card, Col, Row, Space, Tag, message, Upload, Switch, Divider, Alert, Tooltip, Checkbox, Badge, Popconfirm
} from "antd";
import {
  PlusOutlined, FolderOpenOutlined, TagsOutlined, UploadOutlined, BuildOutlined,
  EditOutlined, DeleteOutlined, CopyOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined,
  DownloadOutlined
} from "@ant-design/icons";
import axios from "axios";

const API_URL = (import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://store.poshplexbd.com' : 'http://localhost:8000')) + "/api/v1/catalog";

export const Catalog: React.FC = () => {
  const [activeTab, setActiveTab] = useState("1");
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [attributes, setAttributes] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [sizeTemplates, setSizeTemplates] = useState<any[]>([]);
  const [careTemplates, setCareTemplates] = useState<any[]>([]);

  // Search, Filters & Pagination
  const [searchText, setSearchText] = useState("");
  const [filterCategory, setFilterCategory] = useState<number | undefined>(undefined);
  const [filterBrand, setFilterBrand] = useState<number | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<boolean | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(false);

  // Selected row keys for bulk operations
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isAttributeModalOpen, setIsAttributeModalOpen] = useState(false);
  
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryImage, setCategoryImage] = useState<File | null>(null);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [isCareModalOpen, setIsCareModalOpen] = useState(false);

  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [editingBrand, setEditingBrand] = useState<any>(null);
  const [editingSize, setEditingSize] = useState<any>(null);
  const [editingCare, setEditingCare] = useState<any>(null);
  const [editingAttribute, setEditingAttribute] = useState<any>(null);

  // Variant Builder
  const [productType, setProductType] = useState<"simple" | "variable">("simple");
  const [variantBuilderOptions, setVariantBuilderOptions] = useState<Record<string, string[]>>({
    color: [],
    size: []
  });
  const [variantsList, setVariantsList] = useState<any[]>([]);
  const [bulkPurchasePrice, setBulkPurchasePrice] = useState<number | null>(null);
  const [bulkSellingPrice, setBulkSellingPrice] = useState<number | null>(null);

  // Form hooks
  const [productForm] = Form.useForm();
  const [attributeForm] = Form.useForm();
  const [categoryForm] = Form.useForm();
  const [brandForm] = Form.useForm();
  const [sizeForm] = Form.useForm();
  const [careForm] = Form.useForm();

  // CSV Import mapping state
  const [csvFile, setCsvFile] = useState<any>(null);
  const [parsedCsvData, setParsedCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [columnMapping, setColumnMapping] = useState({
    name: "",
    sku: "",
    product_type: "",
    short_description: "",
    description: "",
    base_price: "",
    category: "",
    subcategory: "",
    brand: "",
    image_url: "",
    variant_sku: "",
    variant_image_url: "",
    variant_price: "",
    variant_size: "",
    variant_color: ""
  });
  const [defaultSettings, setDefaultSettings] = useState<{ category_id?: number; brand_id?: number; product_type?: "simple" | "variable" }>({});
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  // Product Media Upload state
  const [fileList, setFileList] = useState<any[]>([]);
  const [mainImageUid, setMainImageUid] = useState<string | null>(null);

  // Load catalog metadata helpers
  const loadMetadata = async () => {
    try {
      const [catRes, attrRes, brandRes, sizeRes, careRes] = await Promise.all([
        axios.get(`${API_URL}/categories/tree?admin=true`),
        axios.get(`${API_URL}/attributes`),
        axios.get(`${API_URL}/brands`),
        axios.get(`${API_URL}/templates/size`),
        axios.get(`${API_URL}/templates/care`)
      ]);
      setCategories(catRes.data);
      setAttributes(attrRes.data);
      setBrands(brandRes.data);
      setSizeTemplates(sizeRes.data);
      setCareTemplates(careRes.data);
    } catch (err) {
      console.error("Metadata load failed", err);
    }
  };

  // Fetch paginated and filtered products list
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: currentPage,
        limit: pageSize,
      };
      if (searchText) params.search = searchText;
      if (filterCategory) params.category_id = filterCategory;
      if (filterBrand) params.brand_id = filterBrand;
      if (filterStatus !== undefined) params.is_active = filterStatus;

      const res = await axios.get(`${API_URL}/products`, { params });
      setProducts(res.data.results);
      setTotalProducts(res.data.count);
    } catch (err) {
      message.error("Failed to load products list.");
    } finally {
      setLoading(false);
    }
  };

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, filterCategory, filterBrand, filterStatus]);

  // Fetch products when page, page size, or filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, filterCategory, filterBrand, filterStatus, currentPage, pageSize]);

  useEffect(() => {
    loadMetadata();
  }, []);

  const openEditCategory = (node: any) => {
    setEditingCategory(node);
    categoryForm.setFieldsValue({
      name: node.name,
      slug: node.slug,
      parent_id: node.parent_id,
      listing_order: node.listing_order || 0,
      is_active: node.is_active
    });
    setCategoryImage(null);
    setIsCategoryModalOpen(true);
  };

  const openEditBrand = (brand: any) => {
    setEditingBrand(brand);
    brandForm.setFieldsValue(brand);
    setIsBrandModalOpen(true);
  };

  const openEditSize = (size: any) => {
    setEditingSize(size);
    sizeForm.setFieldsValue({
      name: size.name,
      headers: size.headers ? size.headers.join(",") : "",
      rows: size.rows ? size.rows.map((r: any) => r.join(",")).join("\n") : ""
    });
    setIsSizeModalOpen(true);
  };

  const openEditCare = (care: any) => {
    setEditingCare(care);
    careForm.setFieldsValue(care);
    setIsCareModalOpen(true);
  };

  const openEditAttribute = (attr: any) => {
    setEditingAttribute(attr);
    attributeForm.setFieldsValue({
      ...attr,
      choices: attr.choices ? attr.choices.join(",") : ""
    });
    setIsAttributeModalOpen(true);
  };

  const toggleCategoryActive = async (node: any, checked: boolean) => {
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      await axios.put(`${API_URL}/categories/${node.id}`, {
        name: node.name,
        slug: node.slug,
        parent_id: node.parent_id,
        listing_order: node.listing_order || 0,
        is_active: checked
      }, { headers: { Authorization: `Bearer ${token}` } });
      message.success(`Category ${checked ? 'activated' : 'deactivated'}`);
      loadMetadata();
    } catch (err) {
      message.error("Failed to toggle category status.");
    }
  };

  // Format Category Tree
  const formatTreeData = (nodes: any[]): any[] => {
    return nodes.map((node) => ({
      title: (
        <span style={{ display: 'flex', justifyContent: 'space-between', width: '330px', alignItems: 'center' }}>
          <span>
            {node.name}
            {!node.is_active && <Tag color="default" style={{ marginLeft: 8 }}>Inactive</Tag>}
          </span>
          <Space>
             <Switch checked={node.is_active} size="small" onChange={(checked, e) => { e.stopPropagation(); toggleCategoryActive(node, checked); }} />
             <EditOutlined onClick={(e) => { e.stopPropagation(); openEditCategory(node); }} style={{ color: 'var(--ant-primary-color)', cursor: 'pointer' }} />
             <Popconfirm title="Delete this category?" onConfirm={(e) => { e?.stopPropagation(); handleGenericDelete(`/categories/${node.id}`); }} onCancel={(e) => e?.stopPropagation()}><DeleteOutlined onClick={(e) => e.stopPropagation()} style={{ color: 'red', cursor: 'pointer' }} /></Popconfirm>
          </Space>
        </span>
      ),
      key: node.id,
      children: node.children && node.children.length ? formatTreeData(node.children) : [],
    }));
  };
  const treeData = formatTreeData(categories);

  // Duplicate product
  const handleDuplicate = async (id: number) => {
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      await axios.post(`${API_URL}/products/${id}/duplicate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Product duplicated as a draft successfully!");
      fetchProducts();
    } catch (err: any) {
      message.error(err.response?.data?.message || "Duplication failed.");
    }
  };

  // Delete product checking past orders
  const handleDelete = async (id: number) => {
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      await axios.delete(`${API_URL}/products/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Product deleted successfully.");
      fetchProducts();
    } catch (err: any) {
      Modal.error({
        title: "Product Deletion Blocked",
        content: err.response?.data?.message || "This product cannot be deleted as it appears in past orders."
      });
    }
  };

  // Bulk status updates
  const handleBulkStatusUpdate = async (active: boolean) => {
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      await Promise.all(
        selectedRowKeys.map(async (key) => {
          const prod = products.find(p => p.id === key);
          if (prod) {
            await axios.put(`${API_URL}/products/${prod.id}`, {
              name: prod.name,
              sku: prod.sku,
              product_type: prod.product_type,
              short_description: prod.short_description,
              description: prod.description,
              is_active: active,
              is_featured: prod.is_featured,
              base_price: prod.base_price,
              brand_id: prod.brand?.id,
              category_ids: prod.categories.map((c: any) => c.id),
              variants: prod.variants
            }, {
              headers: { Authorization: `Bearer ${token}` }
            });
          }
        })
      );
      message.success(`Successfully ${active ? "activated" : "deactivated"} selected items.`);
      setSelectedRowKeys([]);
      fetchProducts();
    } catch (err) {
      message.error("Bulk status update failed.");
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    Modal.confirm({
      title: "Confirm Bulk Deletion",
      content: "Are you sure you want to delete these products? Products in past orders will block the deletion cascade.",
      onOk: async () => {
        let successCount = 0;
        let failCount = 0;
        const token = localStorage.getItem("poshplex_token") || "admin_imran";
        
        for (const key of selectedRowKeys) {
          try {
            await axios.delete(`${API_URL}/products/${key}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            successCount++;
          } catch (err) {
            failCount++;
          }
        }
        if (successCount > 0) message.success(`Deleted ${successCount} products.`);
        if (failCount > 0) message.warning(`${failCount} products blocked from deletion due to past orders.`);
        setSelectedRowKeys([]);
        fetchProducts();
      }
    });
  };

  // Open Edit Product Modal
  const openEditModal = (product: any) => {
    setEditingProduct(product);
    setProductType(product.product_type);
    
    // Set variant values list
    setVariantsList(product.variants || []);
    
    // Set images
    setFileList(product.images ? product.images.map((img: any) => ({
      uid: img.id.toString(),
      name: `Image ${img.id}`,
      status: 'done',
      url: img.url,
      response: { id: img.id }
    })) : []);
    const mainImg = product.images?.find((img: any) => img.is_main);
    setMainImageUid(mainImg ? mainImg.id.toString() : null);

    const existingFilenames = product.images
      ? product.images.map((img: any) => img.url.split('/').pop()).join(', ')
      : "";
    
    productForm.setFieldsValue({
      name: product.name,
      sku: product.sku,
      product_type: product.product_type,
      short_description: product.short_description,
      description: product.description,
      is_active: product.is_active,
      is_featured: product.is_featured,
      base_price: product.base_price,
      brand_id: product.brand?.id,
      category_ids: product.categories.map((c: any) => c.id),
      size_guide_template_id: product.size_guide_template_id,
      care_instructions_template_id: product.care_instructions_template_id,
      youtube_video_url: product.youtube_video_url,
      video_autoplay: product.video_autoplay,
      video_mute: product.video_mute,
      image_filenames: existingFilenames
    });
    setIsProductModalOpen(true);
  };

  // Open Add Product Modal
  const openAddModal = () => {
    setEditingProduct(null);
    setProductType("simple");
    setVariantsList([]);
    setFileList([]);
    setMainImageUid(null);
    productForm.resetFields();
    productForm.setFieldsValue({ is_active: true, is_featured: false, product_type: "simple", image_filenames: "" });
    setIsProductModalOpen(true);
  };

  const handleProductSubmit = async (values: any) => {
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      
      const cleanVariants = (productType === "variable" ? variantsList : []).map(v => ({
        ...v,
        image_id: typeof v.image_id === 'number' ? v.image_id : null
      }));

      const filenames = values.image_filenames
        ? values.image_filenames.split(',').map((s: string) => s.trim()).filter((s: string) => s)
        : [];

      const { image_filenames, ...restValues } = values;

      const payload = { 
        ...restValues, 
        variants: cleanVariants,
        image_urls: filenames
      };
      let productId = editingProduct?.id;
      let isNew = false;

      let createdProductData: any = null;

      if (editingProduct) {
        const res = await axios.put(`${API_URL}/products/${productId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        createdProductData = res.data;
      } else {
        const res = await axios.post(`${API_URL}/products`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        productId = res.data.id;
        createdProductData = res.data;
        isNew = true;
      }

      try {
        const uidMap: Record<string, number> = {};
        let needsSecondPass = false;

        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];
          if (file.originFileObj) {
            const formData = new FormData();
            formData.append("file", file.originFileObj);
            if (mainImageUid === file.uid) formData.append("is_main", "true");
            formData.append("order", i.toString());

            const upRes = await axios.post(`${API_URL}/products/${productId}/images`, formData, {
              headers: { 
                "Content-Type": "multipart/form-data",
                Authorization: `Bearer ${token}` 
              }
            });
            uidMap[file.uid] = upRes.data.id;
            needsSecondPass = true;
          }
        }

        if (needsSecondPass && productType === "variable") {
          const serverVariants = createdProductData?.variants || [];
          
          const updatedVariants = variantsList.map(v => {
            const serverVariant = serverVariants.find((sv: any) => sv.sku === v.sku);
            return {
              ...v,
              id: serverVariant ? serverVariant.id : v.id,
              image_id: uidMap[v.image_id] || (typeof v.image_id === 'number' ? v.image_id : null)
            };
          });
          
          await axios.put(`${API_URL}/products/${productId}`, {
             ...values,
             variants: updatedVariants
          }, { headers: { Authorization: `Bearer ${token}` } });
        }

        message.success(isNew ? "Product created successfully." : "Product updated successfully.");
        setIsProductModalOpen(false);
        fetchProducts();
      } catch (innerErr) {
        if (isNew && productId) {
          try {
            await axios.delete(`${API_URL}/products/${productId}`, { headers: { Authorization: `Bearer ${token}` } });
            console.log("Rolled back partially created product:", productId);
          } catch (rollbackErr) {
            console.error("Critical: Failed to rollback partially created product", rollbackErr);
          }
        }
        throw innerErr;
      }
    } catch (err: any) {
      const data = err.response?.data;
      let errMsg = "Failed to save product.";
      if (data) {
        if (data.message) errMsg = data.message;
        else if (Array.isArray(data.detail)) {
          errMsg = data.detail.map((d: any) => `${d.loc.join('.')}: ${d.msg}`).join(', ');
        } else if (typeof data.detail === 'string') {
          errMsg = data.detail;
        } else {
          errMsg = JSON.stringify(data);
        }
      }
      message.error(errMsg);
    }
  };

  // Variant generator builder helper
  const handleBulkGenerateVariants = () => {
    const colors = variantBuilderOptions.color;
    const sizes = variantBuilderOptions.size;
    if (colors.length === 0 && sizes.length === 0) {
      message.warning("Select color or size options first.");
      return;
    }
    
    const newVariants: any[] = [];
    const colorVals = colors.length > 0 ? colors : [""];
    const sizeVals = sizes.length > 0 ? sizes : [""];

    colorVals.forEach((color) => {
      sizeVals.forEach((size) => {
        const attrs: any = {};
        const parts: string[] = [];
        if (color) {
          attrs["color"] = color;
          parts.push(color.toUpperCase());
        }
        if (size) {
          attrs["size"] = size;
          parts.push(size.toUpperCase());
        }
        
        let baseSku = productForm.getFieldValue("sku");
        if (!baseSku) {
          const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
          const namePrefix = (productForm.getFieldValue("name") || "PROD").substring(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, "");
          baseSku = `${namePrefix}-${randomSuffix}`;
          productForm.setFieldsValue({ sku: baseSku });
        }
        
        const genSku = `${baseSku}-${parts.join("-")}`;
        
        // Prevent duplicate mapping combo
        const exists = variantsList.some(v => 
          Object.entries(attrs).every(([k, val]) => v.attributes[k] === val)
        );
        
        if (!exists) {
          newVariants.push({
            sku: genSku,
            purchase_price: 0,
            selling_price: productForm.getFieldValue("base_price") || 0,
            is_active: true,
            attributes: attrs
          });
        }
      });
    });

    setVariantsList([...variantsList, ...newVariants]);
    message.success(`Generated ${newVariants.length} variant combinations.`);
  };

  // Handle Attribute creation/edit
  const handleAttributeSubmit = async (values: any) => {
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      const payload = {
        ...values,
        code: values.code.toLowerCase().trim(),
        choices: typeof values.choices === 'string' ? values.choices.split(",") : values.choices
      };
      if (editingAttribute) {
        await axios.put(`${API_URL}/attributes/${editingAttribute.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.post(`${API_URL}/attributes`, payload, { headers: { Authorization: `Bearer ${token}` } });
      }
      message.success("Attribute saved successfully!");
      setIsAttributeModalOpen(false);
      attributeForm.resetFields();
      loadMetadata();
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to save attribute.");
    }
  };

  // Generic CRUD Handlers
  const handleGenericSubmit = async (endpoint: string, values: any, setModalOpen: any, form: any, editingItem: any) => {
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      if (editingItem) {
        await axios.put(`${API_URL}${endpoint}/${editingItem.id}`, values, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.post(`${API_URL}${endpoint}`, values, { headers: { Authorization: `Bearer ${token}` } });
      }
      message.success("Saved successfully!");
      setModalOpen(false);
      form.resetFields();
      loadMetadata();
    } catch (err: any) {
      const data = err.response?.data;
      let errMsg = "Failed to save.";
      if (data) {
        if (data.message) errMsg = data.message;
        else if (Array.isArray(data.detail)) {
          errMsg = data.detail.map((d: any) => `${d.loc.join('.')}: ${d.msg}`).join(', ');
        } else if (typeof data.detail === 'string') {
          errMsg = data.detail;
        } else {
          errMsg = JSON.stringify(data);
        }
      }
      message.error(errMsg);
    }
  };

  const handleGenericDelete = async (endpoint: string) => {
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      await axios.delete(`${API_URL}${endpoint}`, { headers: { Authorization: `Bearer ${token}` } });
      message.success("Deleted successfully!");
      loadMetadata();
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to delete.");
    }
  };

  const handleCategorySubmit = async (values: any) => {
    try {
      const token = localStorage.getItem("poshplex_token") || "admin_imran";
      let catId = editingCategory?.id;
      
      // Save basic info
      if (editingCategory) {
        await axios.put(`${API_URL}/categories/${editingCategory.id}`, values, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        const res = await axios.post(`${API_URL}/categories`, values, { headers: { Authorization: `Bearer ${token}` } });
        catId = res.data.id;
      }
      
      // Upload image if selected
      if (categoryImage && catId) {
        const formData = new FormData();
        formData.append("file", categoryImage);
        await axios.post(`${API_URL}/categories/${catId}/image`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`
          }
        });
      }
      
      message.success("Category saved successfully!");
      setIsCategoryModalOpen(false);
      categoryForm.resetFields();
      setCategoryImage(null);
      loadMetadata();
    } catch (err: any) {
      message.error(err.response?.data?.message || err.response?.data?.detail || "Failed to save category.");
    }
  };
  const handleBrandSubmit = (values: any) => handleGenericSubmit("/brands", values, setIsBrandModalOpen, brandForm, editingBrand);
  const handleSizeSubmit = (values: any) => handleGenericSubmit("/templates/size", { ...values, headers: typeof values.headers === 'string' ? values.headers.split(",") : values.headers, rows: typeof values.rows === 'string' ? values.rows.split("\n").map((r: string) => r.split(",")) : values.rows }, setIsSizeModalOpen, sizeForm, editingSize);
  const handleCareSubmit = (values: any) => handleGenericSubmit("/templates/care", values, setIsCareModalOpen, careForm, editingCare);

  // Client-side sample CSV generation and download
  const downloadSampleCsv = () => {
    const headers = [
      "Product Name",
      "SKU",
      "Product Type",
      "Short Description",
      "Description",
      "Base Price",
      "Category",
      "Subcategory",
      "Brand",
      "image url",
      "Variant SKU",
      "Variant Image Url",
      "Variant Price",
      "Variant Color",
      "Variant Size"
    ];
    const rows = [
      ["GHOST INK", "SKU-495ED1", "variable", "sa", "asas", "799", "Bottom Wear", "Printed Baggy Joggers", "Poshplex", "1781024294094.webp", "SKU-476D88, SKU-FA04FA, SKU-BA50EA", "1781024294094.webp, 17810242940s94.webp, 178d1024294094.webp", "799, 799, 799", "Black, Black, Black", "M, L, XL"]
    ];

    // Build standard CSV string format
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += headers.join(",") + "\n";
    rows.forEach(r => {
      csvContent += r.map(val => `"${val.replace(/"/g, '""')}"`).join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "poshplex_bulk_products_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success("Sample CSV template downloaded successfully!");
  };

  const handleCsvUpload = (file: any) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
      if (lines.length === 0) {
        message.error("CSV file is empty.");
        return;
      }

      const parseLine = (line: string) => {
        const result = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseLine(lines[0]);
      const rows = lines.slice(1).map(parseLine);
      setParsedCsvData({ headers, rows });
      message.success("CSV file parsed successfully! Configure column mapping below.");
    };
    reader.readAsText(file);
  };

  const getMappedValue = (row: string[], colName: string) => {
    if (!colName || !parsedCsvData) return "";
    const idx = parsedCsvData.headers.indexOf(colName);
    return idx !== -1 ? row[idx] : "";
  };

  const getMatchedCategoryId = (catName: string, subcatName?: string) => {
    if (subcatName) {
      const match = flatCategories.find(c => c.name.toLowerCase().includes(subcatName.trim().toLowerCase()));
      if (match) return match.id;
    }
    if (catName) {
      const match = flatCategories.find(c => c.name.toLowerCase().includes(catName.trim().toLowerCase()));
      if (match) return match.id;
    }
    return null;
  };

  const getMatchedBrandId = (brandName: string) => {
    if (!brandName) return null;
    const match = brands.find(b => b.name.toLowerCase() === brandName.trim().toLowerCase());
    return match ? match.id : null;
  };

  const resolveCategory = async (catName: string, subcatName?: string) => {
    const token = localStorage.getItem("poshplex_token") || "admin_imran";
    let matchedId = getMatchedCategoryId(catName, subcatName);
    if (matchedId) return matchedId;

    if (catName) {
      try {
        const slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const res = await axios.post(`${API_URL}/categories`, { name: catName, slug }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        await loadMetadata();
        return res.data.id;
      } catch (err) {
        console.error("Auto category creation failed", err);
      }
    }
    return defaultSettings.category_id || null;
  };

  const resolveBrand = async (brandName: string) => {
    const token = localStorage.getItem("poshplex_token") || "admin_imran";
    let matchedId = getMatchedBrandId(brandName);
    if (matchedId) return matchedId;

    if (brandName) {
      try {
        const slug = brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const res = await axios.post(`${API_URL}/brands`, { name: brandName, slug }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        await loadMetadata();
        return res.data.id;
      } catch (err) {
        console.error("Auto brand creation failed", err);
      }
    }
    return defaultSettings.brand_id || null;
  };

  const previewRows = parsedCsvData
    ? parsedCsvData.rows.map((row, rowIdx) => {
        const name = getMappedValue(row, columnMapping.name);
        const sku = getMappedValue(row, columnMapping.sku);
        const product_type = getMappedValue(row, columnMapping.product_type) || defaultSettings.product_type || "simple";
        const short_description = getMappedValue(row, columnMapping.short_description);
        const description = getMappedValue(row, columnMapping.description);
        const base_price_str = getMappedValue(row, columnMapping.base_price);
        const base_price = base_price_str ? parseFloat(base_price_str) : 0;
        
        const category = getMappedValue(row, columnMapping.category);
        const subcategory = getMappedValue(row, columnMapping.subcategory);
        const brand = getMappedValue(row, columnMapping.brand);
        const image_url = getMappedValue(row, columnMapping.image_url);

        const variant_sku = getMappedValue(row, columnMapping.variant_sku);
        const variant_image_url = getMappedValue(row, columnMapping.variant_image_url);
        const variant_price_str = getMappedValue(row, columnMapping.variant_price);
        const variant_price = variant_price_str || "";
        const variant_size = getMappedValue(row, columnMapping.variant_size);
        const variant_color = getMappedValue(row, columnMapping.variant_color);

        return {
          key: rowIdx,
          name,
          sku,
          product_type,
          short_description,
          description,
          base_price,
          category,
          subcategory,
          brand,
          image_url,
          variant_sku,
          variant_image_url,
          variant_price,
          variant_size,
          variant_color
        };
      })
    : [];

  const executeBulkImport = async () => {
    if (previewRows.length === 0) return;
    setImportLoading(true);
    setImportProgress({ current: 0, total: previewRows.length });
    const token = localStorage.getItem("poshplex_token") || "admin_imran";

    const groups: Record<string, typeof previewRows> = {};
    previewRows.forEach((row) => {
      const key = row.sku || row.name;
      if (key) {
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
      }
    });

    const groupKeys = Object.keys(groups);
    let successCount = 0;
    let failCount = 0;
    let processedRows = 0;

    for (let k = 0; k < groupKeys.length; k++) {
      const key = groupKeys[k];
      const rows = groups[key];
      const firstRow = rows[0];

      if (!firstRow.name) {
        failCount += rows.length;
        processedRows += rows.length;
        setImportProgress({ current: processedRows, total: previewRows.length });
        continue;
      }

      try {
        const resolvedCategoryId = await resolveCategory(firstRow.category, firstRow.subcategory);
        const category_ids = resolvedCategoryId ? [resolvedCategoryId] : [];
        const resolvedBrandId = await resolveBrand(firstRow.brand);

        const variants: any[] = [];
        if (firstRow.product_type === "variable") {
          rows.forEach((r) => {
            const skus = r.variant_sku ? r.variant_sku.split(",").map((s: string) => s.trim()).filter((s: string) => s) : [];
            const prices = r.variant_price ? String(r.variant_price).split(",").map((s: string) => s.trim()).filter((s: string) => s) : [];
            const sizes = r.variant_size ? r.variant_size.split(",").map((s: string) => s.trim()).filter((s: string) => s) : [];
            const colors = r.variant_color ? r.variant_color.split(",").map((s: string) => s.trim()).filter((s: string) => s) : [];
            const images = r.variant_image_url ? r.variant_image_url.split(",").map((s: string) => {
              const url = s.trim();
              return (url && !url.startsWith("http")) ? `${(import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://store.poshplexbd.com' : 'http://localhost:8000'))}/media/${url}` : url;
            }).filter((s: string) => s) : [];

            if (skus.length > 0) {
              skus.forEach((sku: string, index: number) => {
                const attrs: Record<string, string> = {};
                if (sizes[index]) attrs["size"] = sizes[index];
                else if (sizes[0]) attrs["size"] = sizes[0]; // fallback

                if (colors[index]) attrs["color"] = colors[index];
                else if (colors[0]) attrs["color"] = colors[0]; // fallback

                let vPrice = r.base_price || 0;
                if (prices[index]) vPrice = parseFloat(prices[index]);
                else if (prices[0]) vPrice = parseFloat(prices[0]);

                let vImage = null;
                if (images[index]) vImage = images[index];
                else if (images[0]) vImage = images[0];

                variants.push({
                  sku: sku,
                  purchase_price: 0,
                  selling_price: vPrice,
                  is_active: true,
                  attributes: attrs,
                  variant_image_url: vImage
                });
              });
            } else {
              // fallback if no SKUs provided but variable is selected
              const attrs: Record<string, string> = {};
              if (r.variant_size) attrs["size"] = r.variant_size.split(",")[0].trim();
              if (r.variant_color) attrs["color"] = r.variant_color.split(",")[0].trim();
              
              let vPrice = r.base_price || 0;
              if (r.variant_price) vPrice = parseFloat(String(r.variant_price).split(",")[0].trim()) || vPrice;
              
              let vImage = r.variant_image_url ? r.variant_image_url.split(",")[0].trim() : null;
              if (vImage && !vImage.startsWith("http")) vImage = `${(import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://store.poshplexbd.com' : 'http://localhost:8000'))}/media/${vImage}`;

              variants.push({
                sku: `VAR-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
                purchase_price: 0,
                selling_price: vPrice,
                is_active: true,
                attributes: attrs,
                variant_image_url: vImage
              });
            }
          });
        } else {
          variants.push({
            sku: firstRow.sku || `VAR-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            purchase_price: 0,
            selling_price: firstRow.base_price || 0,
            is_active: true,
            attributes: {}
          });
        }

        let mainImageUrl = firstRow.image_url ? firstRow.image_url.trim() : null;
        if (mainImageUrl && !mainImageUrl.startsWith("http")) {
          mainImageUrl = `${(import.meta.env.VITE_SERVER_URL || (window.location.hostname === 'admin.poshplexbd.com' ? 'https://store.poshplexbd.com' : 'http://localhost:8000'))}/media/${mainImageUrl}`;
        }
        const image_urls = mainImageUrl ? [mainImageUrl] : [];

        const payload = {
          name: firstRow.name,
          sku: firstRow.sku || null,
          product_type: firstRow.product_type,
          short_description: firstRow.short_description || "",
          description: firstRow.description || "",
          is_active: true,
          is_featured: false,
          base_price: firstRow.base_price || 0,
          brand_id: resolvedBrandId,
          category_ids,
          variants,
          image_urls
        };

        const existingProduct = products.find(p => p.sku && firstRow.sku && p.sku.trim().toLowerCase() === firstRow.sku.trim().toLowerCase());

        if (existingProduct) {
          const updatedVariants = variants.map(v => {
            const matchedVar = existingProduct.variants?.find((ev: any) => ev.sku === v.sku);
            return {
              ...v,
              id: matchedVar ? matchedVar.id : undefined
            };
          });
          
          await axios.put(`${API_URL}/products/${existingProduct.slug}`, {
            ...payload,
            variants: updatedVariants
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } else {
          await axios.post(`${API_URL}/products`, payload, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }

        successCount += rows.length;
      } catch (err) {
        console.error("Failed to import product group", key, err);
        failCount += rows.length;
      }

      processedRows += rows.length;
      setImportProgress({ current: processedRows, total: previewRows.length });
    }

    message.success(`Bulk import completed: ${successCount} entries registered successfully, ${failCount} failed.`);
    setImportLoading(false);
    setParsedCsvData(null);
    setCsvFile(null);
    setColumnMapping({
      name: "",
      sku: "",
      product_type: "",
      short_description: "",
      description: "",
      base_price: "",
      category: "",
      subcategory: "",
      brand: "",
      image_url: "",
      variant_sku: "",
      variant_image_url: "",
      variant_price: "",
      variant_size: "",
      variant_color: ""
    });
    setImportProgress({ current: 0, total: 0 });
    fetchProducts();
  };

  // Columns structure for main table
  const mainColumns = [
    {
      title: "Main Image",
      dataIndex: "images",
      key: "images",
      width: 100,
      render: (images: any[]) => {
        const main = images?.find(img => img.is_main) || images?.[0];
        return main ? (
          <img src={main.url} alt="Main" style={{ width: 44, height: 44, objectFit: "cover", border: "1px solid var(--border-glass)" }} />
        ) : (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>No Image</span>
        );
      }
    },
    { title: "SKU", dataIndex: "sku", key: "sku", width: 140 },
    { title: "Product Name", dataIndex: "name", key: "name", render: (text: string) => <b>{text}</b> },
    {
      title: "Type",
      dataIndex: "product_type",
      key: "product_type",
      width: 100,
      render: (type: string) => <Tag color={type === "variable" ? "purple" : "blue"}>{type?.toUpperCase()}</Tag>
    },
    {
      title: "Categories",
      dataIndex: "categories",
      key: "categories",
      render: (cats: any[]) => (
        <Space wrap>{cats?.map(c => <Tag key={c.id}>{c.name}</Tag>)}</Space>
      )
    },
    {
      title: "Status & Badges",
      key: "status",
      width: 180,
      render: (record: any) => (
        <Space>
          {record.is_active ? (
            <Tag icon={<CheckCircleOutlined />} color="success">ACTIVE</Tag>
          ) : (
            <Tag icon={<CloseCircleOutlined />} color="default">INACTIVE</Tag>
          )}
          {record.is_featured && <Tag color="warning">FEATURED</Tag>}
        </Space>
      )
    },
    {
      title: "Pricing",
      key: "pricing",
      width: 120,
      render: (record: any) => {
        if (record.product_type === "simple") {
          return <span>৳{Math.round(record.base_price || 0)}</span>;
        } else {
          const prices = record.variants?.map((v: any) => v.selling_price) || [];
          const min = prices.length ? Math.min(...prices) : 0;
          return <span>Min: ৳{Math.round(min)}</span>;
        }
      }
    },
    {
      title: "Actions",
      key: "actions",
      width: 180,
      render: (record: any) => (
        <Space>
          <Tooltip title="Preview Storefront">
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => window.open(`http://localhost:3000/product/${record.slug}`, "_blank")} 
            />
          </Tooltip>
          <Button type="text" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
          <Button type="text" icon={<CopyOutlined />} onClick={() => handleDuplicate(record.id)} />
          <Popconfirm title="Delete this product?" onConfirm={() => handleDelete(record.id)}><Button type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
        </Space>
      )
    }
  ];

  const getFlatCategories = (list: any[], prefix = ""): any[] => {
    let flat: any[] = [];
    list.forEach(c => {
      flat.push({ id: c.id, name: prefix + c.name });
      if (c.children && c.children.length) {
        flat = flat.concat(getFlatCategories(c.children, prefix + "â€” "));
      }
    });
    return flat;
  };
  const flatCategories = getFlatCategories(categories);

  const colorAttr = attributes.find(a => a.code.toLowerCase() === "color");
  const sizeAttr = attributes.find(a => a.code.toLowerCase() === "size");

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text-main)" }}>Product Catalog</h1>
          <Badge count={totalProducts} overflowCount={99999} color="var(--accent-cyan)" />
        </div>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13 }}>Manage streetwear drop entries, configure variants, and upload spreadsheets.</p>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card" items={[
        
        /* TAB 1: Product Listings */
        { label: <span><BuildOutlined /> Drop Listings</span>, key: "1", children: (
          <Card
            title={
              <Space wrap size="middle">
                <Input
                  placeholder="Search Name or SKU..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ width: 220, borderRadius: 0 }}
                />
                <Select
                  placeholder="Category Filter"
                  allowClear
                  onChange={setFilterCategory}
                  style={{ width: 160 }}
                >
                  {flatCategories.map((c: any) => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
                </Select>
                <Select
                  placeholder="Brand Filter"
                  allowClear
                  onChange={setFilterBrand}
                  style={{ width: 140 }}
                >
                  {brands.map((b: any) => <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>)}
                </Select>
                <Select
                  placeholder="Status Filter"
                  allowClear
                  onChange={setFilterStatus}
                  style={{ width: 140 }}
                >
                  <Select.Option value={true}>Active</Select.Option>
                  <Select.Option value={false}>Inactive</Select.Option>
                </Select>
              </Space>
            }
            extra={
              <Space>
                {selectedRowKeys.length > 0 && (
                  <Space style={{ marginRight: 16 }}>
                    <Button onClick={() => handleBulkStatusUpdate(true)}>Activate</Button>
                    <Button onClick={() => handleBulkStatusUpdate(false)}>Deactivate</Button>
                    <Button danger onClick={handleBulkDelete}>Delete</Button>
                  </Space>
                )}
                <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal} style={{ borderRadius: 0 }}>
                  Create Drop Entry
                </Button>
              </Space>
            }
          >
            <Table scroll={{ x: 'max-content' }}
              rowSelection={{
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys)
              }}
              dataSource={products}
              columns={mainColumns}
              rowKey="id"
              loading={loading}
              pagination={{
                current: currentPage,
                pageSize: pageSize,
                total: totalProducts,
                showSizeChanger: true,
                onChange: (page, size) => {
                  setCurrentPage(page);
                  setPageSize(size || 10);
                }
              }}
            />
          </Card>
        ) },

        /* TAB 2: Categories tree hierarchy */
        { label: <span><FolderOpenOutlined /> Structure Tree</span>, key: "2", children: (
          <Card 
            title="Structural Categories Tree"
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingCategory(null); categoryForm.resetFields(); setIsCategoryModalOpen(true); }} style={{ borderRadius: 0 }}>
                Create Category
              </Button>
            }
          >
            {treeData.length ? (
              <Tree
                showLine
                defaultExpandAll
                treeData={treeData}
                style={{ background: "transparent", color: "var(--text-main)", fontSize: 16 }}
              />
            ) : (
              <span style={{ color: "var(--text-muted)" }}>No Category configurations defined.</span>
            )}
          </Card>
        ) },

        /* TAB 3: Attributes Setup */
        { label: <span><TagsOutlined /> Specification Attributes</span>, key: "3", children: (
          <Card
            title="Global Attributes Configuration"
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsAttributeModalOpen(true)} style={{ borderRadius: 0 }}>
                Define Attribute
              </Button>
            }
          >
            <Table scroll={{ x: 'max-content' }}
              dataSource={attributes}
              rowKey="id"
              columns={[
                { title: "Label", dataIndex: "name", key: "name" },
                { title: "Code", dataIndex: "code", key: "code", render: (code: string) => <code>{code}</code> },
                { title: "Type", dataIndex: "type", key: "type", render: (t) => <Tag color="blue">{t?.toUpperCase()}</Tag> },
                { title: "Choices", dataIndex: "choices", key: "choices", render: (choices: string[]) => choices?.join(", ") || "-" },
                {
                  title: "Actions",
                  key: "actions",
                  width: 120,
                  render: (record: any) => (
                    <Space>
                      <Button type="text" icon={<EditOutlined />} onClick={() => openEditAttribute(record)} />
                      <Popconfirm title="Delete this attribute?" onConfirm={() => handleGenericDelete(`/attributes/${record.id}`)}><Button type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
                    </Space>
                  )
                }
              ]}
            />
          </Card>
        ) },

        /* TAB 4: Spreadsheet CSV Import */
        { label: <span><UploadOutlined /> Excel / CSV Bulk Import</span>, key: "4", children: (
          <Card title="Spreadsheet Inventory Uploader">
            {!parsedCsvData ? (
              <div>
                <Alert
                  message="Bulk CSV Import Guide & Template"
                  description="Upload your catalog items in bulk using a structured CSV file. The template supports both simple and variable products, including variant SKU pricing, image URLs, and size/color details. We recommend downloading our official sample template below to see the correct format."
                  type="info"
                  showIcon
                  style={{ marginBottom: 20 }}
                  action={
                    <Button size="small" type="primary" onClick={downloadSampleCsv} style={{ borderRadius: 0 }}>
                      Download CSV Template
                    </Button>
                  }
                />

                <Upload.Dragger
                  beforeUpload={(file) => {
                    handleCsvUpload(file);
                    return false;
                  }}
                  multiple={false}
                  showUploadList={false}
                  accept=".csv"
                >
                  <p className="ant-upload-drag-icon">
                    <UploadOutlined style={{ fontSize: 40, color: "var(--accent-purple)" }} />
                  </p>
                  <p className="ant-upload-text">Click or drag CSV file here to start column mapping</p>
                </Upload.Dragger>
              </div>
            ) : (
              <div>
                <Alert
                  message="Column Mapping Configuration"
                  description="Select which CSV headers correspond to the required Product Catalog parameters. The preview table below will dynamically update to show how the products will be imported."
                  type="warning"
                  showIcon
                  style={{ marginBottom: 20 }}
                  action={
                    <Button size="small" onClick={() => setParsedCsvData(null)}>
                      Upload Different File
                    </Button>
                  }
                />

                <Card type="inner" title="Field Alignment Mapping" style={{ marginBottom: 24 }}>
                  <Row gutter={[16, 16]}>
                    <Col span={8}>
                      <Form.Item label="Product Name (Required)" required>
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.name}
                          onChange={(val) => setColumnMapping({ ...columnMapping, name: val })}
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="SKU" required>
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.sku}
                          onChange={(val) => setColumnMapping({ ...columnMapping, sku: val })}
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Product Type" required>
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.product_type}
                          onChange={(val) => setColumnMapping({ ...columnMapping, product_type: val })}
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col span={8}>
                      <Form.Item label="Base Price" required>
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.base_price}
                          onChange={(val) => setColumnMapping({ ...columnMapping, base_price: val })}
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Short Description">
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.short_description}
                          onChange={(val) => setColumnMapping({ ...columnMapping, short_description: val })}
                          allowClear
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Full Description">
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.description}
                          onChange={(val) => setColumnMapping({ ...columnMapping, description: val })}
                          allowClear
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col span={8}>
                      <Form.Item label="Category">
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.category}
                          onChange={(val) => setColumnMapping({ ...columnMapping, category: val })}
                          allowClear
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Subcategory">
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.subcategory}
                          onChange={(val) => setColumnMapping({ ...columnMapping, subcategory: val })}
                          allowClear
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Brand">
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.brand}
                          onChange={(val) => setColumnMapping({ ...columnMapping, brand: val })}
                          allowClear
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Form.Item label="Product Main Image URL">
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.image_url}
                          onChange={(val) => setColumnMapping({ ...columnMapping, image_url: val })}
                          allowClear
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider style={{ margin: "12px 0" }}>Variant-Specific Configurations</Divider>

                  <Row gutter={[16, 16]}>
                    <Col span={8}>
                      <Form.Item label="Variant SKU">
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.variant_sku}
                          onChange={(val) => setColumnMapping({ ...columnMapping, variant_sku: val })}
                          allowClear
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Variant Price">
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.variant_price}
                          onChange={(val) => setColumnMapping({ ...columnMapping, variant_price: val })}
                          allowClear
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Variant Image URL">
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.variant_image_url}
                          onChange={(val) => setColumnMapping({ ...columnMapping, variant_image_url: val })}
                          allowClear
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Form.Item label="Variant Color Option">
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.variant_color}
                          onChange={(val) => setColumnMapping({ ...columnMapping, variant_color: val })}
                          allowClear
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Variant Size Option">
                        <Select
                          placeholder="Select CSV Column"
                          value={columnMapping.variant_size}
                          onChange={(val) => setColumnMapping({ ...columnMapping, variant_size: val })}
                          allowClear
                        >
                          {parsedCsvData.headers.map((h, idx) => (
                            <Select.Option key={idx} value={h}>{h}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider style={{ margin: "12px 0" }}>Fallback Defaults (When Mappings Are Empty)</Divider>

                  <Row gutter={[16, 16]}>
                    <Col span={8}>
                      <Form.Item label="Default Category">
                        <Select
                          placeholder="Select default category"
                          value={defaultSettings.category_id}
                          onChange={(val) => setDefaultSettings({ ...defaultSettings, category_id: val })}
                          allowClear
                        >
                          {flatCategories.map((c: any) => (
                            <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Default Brand">
                        <Select
                          placeholder="Select default brand"
                          value={defaultSettings.brand_id}
                          onChange={(val) => setDefaultSettings({ ...defaultSettings, brand_id: val })}
                          allowClear
                        >
                          {brands.map((b: any) => (
                            <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Default Product Type">
                        <Select
                          placeholder="Select default type"
                          value={defaultSettings.product_type}
                          onChange={(val) => setDefaultSettings({ ...defaultSettings, product_type: val })}
                          allowClear
                        >
                          <Select.Option value="simple">Simple Product</Select.Option>
                          <Select.Option value="variable">Variable Product</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                <Card title="Product Import Table Preview (Live Rearranged matches)" style={{ marginBottom: 24 }}>
                  <Table scroll={{ x: 'max-content' }}
                    dataSource={previewRows}
                    rowKey="key"
                    columns={[
                      { title: "Product Name", dataIndex: "name", key: "name", render: (t) => t || <span style={{ color: "red" }}>Missing Parameter</span> },
                      { title: "SKU", dataIndex: "sku", key: "sku", render: (t) => t || <span style={{ color: "orange" }}>No SKU (Auto-generated)</span> },
                      { title: "Type", dataIndex: "product_type", key: "product_type", render: (t) => <Tag color={t === "variable" ? "purple" : "blue"}>{String(t).toUpperCase()}</Tag> },
                      { title: "Base Price", dataIndex: "base_price", key: "base_price", render: (t) => `৳${Math.round(t || 0)}` },
                      { title: "Category", dataIndex: "category", key: "category", render: (t, r) => t || (r.subcategory ? `Sub: ${r.subcategory}` : "-") },
                      { title: "Brand", dataIndex: "brand", key: "brand", render: (t) => t || "-" },
                      { title: "Variant SKU", dataIndex: "variant_sku", key: "variant_sku", render: (t) => t || "-" },
                      { title: "Variant Options", key: "options", render: (record) => (record.variant_color || record.variant_size) ? `${record.variant_color || ""} ${record.variant_size || ""}` : "-" },
                      { title: "Variant Price", dataIndex: "variant_price", key: "variant_price", render: (t) => t ? `৳${Math.round(t)}` : "-" }
                    ]}
                    pagination={{ pageSize: 10 }}
                  />
                </Card>

                {importLoading && (
                  <div style={{ margin: "20px 0" }}>
                    <p style={{ fontWeight: 600 }}>Import Progress: {importProgress.current} / {importProgress.total} processed</p>
                    <div style={{ height: 10, background: "#f3f4f6", width: "100%", position: "relative", overflow: "hidden", marginBottom: 20 }}>
                      <div style={{
                        height: "100%",
                        background: "var(--accent-purple)",
                        width: `${(importProgress.current / importProgress.total) * 100}%`,
                        transition: "width 0.2s ease"
                      }} />
                    </div>
                  </div>
                )}

                <Button
                  type="primary"
                  onClick={executeBulkImport}
                  loading={importLoading}
                  style={{ borderRadius: 0 }}
                  disabled={previewRows.length === 0}
                >
                  Confirm and Import Products Catalog
                </Button>
              </div>
            )}
          </Card>
        ) },

        /* TAB 5: Brands */
        { label: <span><TagsOutlined /> Brands</span>, key: "5", children: (
          <Card
            title="Brand Management"
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingBrand(null); brandForm.resetFields(); setIsBrandModalOpen(true); }} style={{ borderRadius: 0 }}>
                Add Brand
              </Button>
            }
          >
            <Table scroll={{ x: 'max-content' }}
              dataSource={brands}
              rowKey="id"
              columns={[
                { title: "ID", dataIndex: "id", key: "id", width: 60 },
                { title: "Brand Name", dataIndex: "name", key: "name" },
                { title: "Slug", dataIndex: "slug", key: "slug" },
                {
                  title: "Actions",
                  key: "actions",
                  width: 120,
                  render: (record: any) => (
                    <Space>
                      <Button type="text" icon={<EditOutlined />} onClick={() => openEditBrand(record)} />
                      <Popconfirm title="Delete this brand?" onConfirm={() => handleGenericDelete(`/brands/${record.id}`)}><Button type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
                    </Space>
                  )
                }
              ]}
            />
          </Card>
        ) },

        /* TAB 6: Size Guides */
        { label: <span><BuildOutlined /> Size Guides</span>, key: "6", children: (
          <Card
            title="Size Guide Templates"
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingSize(null); sizeForm.resetFields(); setIsSizeModalOpen(true); }} style={{ borderRadius: 0 }}>
                Create Size Guide
              </Button>
            }
          >
            <Table scroll={{ x: 'max-content' }}
              dataSource={sizeTemplates}
              rowKey="id"
              columns={[
                { title: "ID", dataIndex: "id", key: "id", width: 60 },
                { title: "Template Name", dataIndex: "name", key: "name" },
                {
                  title: "Actions",
                  key: "actions",
                  width: 120,
                  render: (record: any) => (
                    <Space>
                      <Button type="text" icon={<EditOutlined />} onClick={() => openEditSize(record)} />
                      <Popconfirm title="Delete this size template?" onConfirm={() => handleGenericDelete(`/templates/size/${record.id}`)}><Button type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
                    </Space>
                  )
                }
              ]}
            />
          </Card>
        ) },

        /* TAB 7: Wash & Care Templates */
        { label: <span><TagsOutlined /> Wash & Care Templates</span>, key: "7", children: (
          <Card
            title="Wash & Care Templates"
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingCare(null); careForm.resetFields(); setIsCareModalOpen(true); }} style={{ borderRadius: 0 }}>
                Create Template
              </Button>
            }
          >
            <Table scroll={{ x: 'max-content' }}
              dataSource={careTemplates}
              rowKey="id"
              columns={[
                { title: "ID", dataIndex: "id", key: "id", width: 60 },
                { title: "Template Name", dataIndex: "name", key: "name" },
                {
                  title: "Actions",
                  key: "actions",
                  width: 120,
                  render: (record: any) => (
                    <Space>
                      <Button type="text" icon={<EditOutlined />} onClick={() => openEditCare(record)} />
                      <Popconfirm title="Delete this care template?" onConfirm={() => handleGenericDelete(`/templates/care/${record.id}`)}><Button type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
                    </Space>
                  )
                }
              ]}
            />
          </Card>
        ) }
      ]} />

      {/* Unified Add / Edit Product Modal */}
      <Modal
        title={editingProduct ? "Edit Street Drop Entry" : "Create New Street Drop Entry"}
        open={isProductModalOpen}
        onCancel={() => setIsProductModalOpen(false)}
        width="min(900px, 96vw)"
        onOk={() => productForm.submit()}
        styles={{ body: { paddingTop: 16 } }}
      >
        <Form form={productForm} onFinish={handleProductSubmit} layout="vertical">
          <Tabs defaultActiveKey="basic" type="line" items={[
          
          /* Tab A: Basic Information */
          { label: "Basic Info", key: "basic", children: (
              <>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="name" label="Product Name" rules={[{ required: true, message: "Please enter product name!" }]}>
                    <Input placeholder="e.g. Acid-Wash Oversized Heavy Tee" style={{ borderRadius: 0 }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="sku" label="SKU Identifier (Auto-generated if empty)">
                    <Input placeholder="e.g. PP-TEE-ACID-BLK" style={{ borderRadius: 0 }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="product_type" label="Product Option Layout" rules={[{ required: true }]}>
                    <Select onChange={(val) => setProductType(val as any)}>
                      <Select.Option value="simple">Simple (Single Base Pricing)</Select.Option>
                      <Select.Option value="variable">Variable (Option combinations builder)</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={5}>
                  <Form.Item name="is_active" label="Storefront Active" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="is_featured" label="Homepage Featured" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={5}>
                  <Form.Item name="listing_order" label="Listing Order" initialValue={0}>
                    <InputNumber style={{ width: '100%', borderRadius: 0 }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="short_description" label="Short Description (Above the fold teaser text)">
                <Input.TextArea placeholder="Enter primary streetwear specs highlights..." rows={2} style={{ borderRadius: 0 }} />
              </Form.Item>
              <Form.Item name="description" label="Full Rich Description">
                <Input.TextArea placeholder="Enter rich specifications details..." rows={4} style={{ borderRadius: 0 }} />
              </Form.Item>
              </>
            ) },

          /* Tab B: Media Uploads */
          { label: "Media Gallery", key: "media", forceRender: true, children: (
              <>
              <Upload
                listType="picture-card"
                fileList={fileList}
                beforeUpload={() => false}
                onChange={({ fileList: newFileList }) => setFileList(newFileList)}
              >
                {fileList.length >= 8 ? null : <div><PlusOutlined /><div style={{ marginTop: 8 }}>Upload</div></div>}
              </Upload>
              {fileList.length > 0 && (
                <div style={{ marginTop: 16, marginBottom: 24 }}>
                  <p>Select Main Image:</p>
                  <Space wrap>
                    {fileList.map((file) => (
                      <Button 
                        key={file.uid} 
                        type={mainImageUid === file.uid ? "primary" : "default"}
                        onClick={() => setMainImageUid(file.uid)}
                      >
                        {file.name || 'Image'}
                      </Button>
                    ))}
                  </Space>
                </div>
              )}

              <Form.Item 
                name="image_filenames" 
                label="Associated Media Library Image Filenames"
                help="Type or paste filenames of images already uploaded in the central Media Library (separated by commas, e.g. hoodie-front.webp, hoodie-back.webp). This will automatically link them to the product gallery."
              >
                <Input.TextArea placeholder="e.g. 1781024294094.webp, 17810242940s94.webp" rows={2} style={{ borderRadius: 0 }} />
              </Form.Item>

              <Divider>Video Media</Divider>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item name="youtube_video_url" label="YouTube Video Embed Link">
                    <Input placeholder="e.g. https://www.youtube.com/watch?v=XXXXXX" style={{ borderRadius: 0 }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="video_autoplay" label="Autoplay Video" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="video_mute" label="Mute Video on Load" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
              </>
            ) },

          /* Tab C: Categorization */
          { label: "Categorization & Tags", key: "categorization", forceRender: true, children: (
              <>
              <Form.Item name="category_ids" label="Linked Drop Categories (Multi-select)" rules={[{ required: true, message: "Select at least one category!" }]}>
                <Select mode="multiple" placeholder="Select multiple collections mapping">
                  {flatCategories.map((c: any) => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
                </Select>
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="brand_id" label="Linked Brand">
                    <Select placeholder="Select brand label" allowClear>
                      {brands.map((b: any) => <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>)}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              </>
            ) },

          /* Tab C: Pricing & Variants Builder */
          { label: "Pricing & Variants", key: "pricing", forceRender: true, children: (
              productType === "simple" ? (
                <div>
                  <Form.Item name="base_price" label="Base Retail Price (৳)" rules={[{ required: true, message: "Please input base price!" }]}>
                    <InputNumber style={{ width: "100%", borderRadius: 0 }} min={0} precision={2} />
                  </Form.Item>
                  <Alert message="Simple products use a single base pricing value mapped to the default variant SKU." type="info" showIcon />
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <Row gutter={16} align="bottom">
                    <Col span={8}>
                      <Form.Item label="Option Colors (Select or Type)">
                        <Select
                          mode="tags"
                          placeholder="e.g. Black, White"
                          onChange={(val) => setVariantBuilderOptions({ ...variantBuilderOptions, color: val })}
                          value={variantBuilderOptions.color}
                        >
                          {colorAttr?.choices?.map((c: string) => (
                            <Select.Option key={c} value={c}>{c}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Option Sizes (Select or Type)">
                        <Select
                          mode="tags"
                          placeholder="e.g. S, M, L, XL"
                          onChange={(val) => setVariantBuilderOptions({ ...variantBuilderOptions, size: val })}
                          value={variantBuilderOptions.size}
                        >
                          {sizeAttr?.choices?.map((c: string) => (
                            <Select.Option key={c} value={c}>{c}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Button type="primary" block onClick={handleBulkGenerateVariants} style={{ height: 38, borderRadius: 0 }}>
                        Auto-Generate Combinations
                      </Button>
                    </Col>
                  </Row>

                  {/* ── Apply to All Bulk Price Row ── */}
                  {variantsList.length > 0 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      background: 'rgba(139,92,246,0.08)',
                      border: '1px solid rgba(139,92,246,0.25)',
                      borderRadius: 6,
                      marginBottom: 10
                    }}>
                      <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        Apply to All:
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>Purchase Cost (৳)</span>
                        <InputNumber
                          placeholder="e.g. 350"
                          min={0}
                          value={bulkPurchasePrice}
                          onChange={(val) => setBulkPurchasePrice(val)}
                          style={{ width: 120, borderRadius: 4 }}
                        />
                        <Button
                          size="small"
                          type="primary"
                          style={{ borderRadius: 4, background: '#7c3aed', borderColor: '#7c3aed' }}
                          disabled={bulkPurchasePrice === null}
                          onClick={() => {
                            setVariantsList(variantsList.map(v => ({ ...v, purchase_price: bulkPurchasePrice })));
                          }}
                        >
                          Apply
                        </Button>
                      </div>
                      <div style={{ width: 1, height: 24, background: 'rgba(139,92,246,0.3)' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>Selling Price (৳)</span>
                        <InputNumber
                          placeholder="e.g. 650"
                          min={0}
                          value={bulkSellingPrice}
                          onChange={(val) => setBulkSellingPrice(val)}
                          style={{ width: 120, borderRadius: 4 }}
                        />
                        <Button
                          size="small"
                          type="primary"
                          style={{ borderRadius: 4, background: '#7c3aed', borderColor: '#7c3aed' }}
                          disabled={bulkSellingPrice === null}
                          onClick={() => {
                            setVariantsList(variantsList.map(v => ({ ...v, selling_price: bulkSellingPrice })));
                          }}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  )}

                  <Table scroll={{ x: 'max-content' }}
                    size="small"
                    dataSource={variantsList}
                    rowKey={(record) => record.sku}
                    pagination={false}
                    columns={[
                      {
                        title: "Variant Image",
                        key: "image",
                        width: 140,
                        render: (record, r, idx) => (
                        <Select 
                            allowClear 
                            placeholder="Select Image" 
                            style={{ width: '100%' }}
                            value={record.image_id}
                            optionLabelProp="label"
                            dropdownStyle={{ padding: 4 }}
                            onChange={(val) => {
                              const updated = [...variantsList];
                              updated[idx].image_id = val;
                              setVariantsList(updated);
                            }}
                          >
                            {fileList.map((f: any) => {
                              const previewSrc = f.thumbUrl || f.url || (f.originFileObj ? URL.createObjectURL(f.originFileObj) : null);
                              return (
                                <Select.Option
                                  key={f.uid}
                                  value={f.response?.id || f.uid}
                                  label={
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      {previewSrc && (
                                        <img src={previewSrc} alt="" style={{ width: 20, height: 20, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} />
                                      )}
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{f.name}</span>
                                    </span>
                                  }
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                                    {previewSrc ? (
                                      <img src={previewSrc} alt={f.name} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0, border: '1px solid #333' }} />
                                    ) : (
                                      <div style={{ width: 36, height: 36, background: '#222', borderRadius: 4, flexShrink: 0 }} />
                                    )}
                                    <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                  </div>
                                </Select.Option>
                              );
                            })}
                          </Select>

                        )
                      },
                      {
                        title: "Attributes Combo",
                        key: "combo",
                        render: (record) => (
                          <Space>
                            {Object.entries(record.attributes)
                              .sort(([a], [b]) => {
                                const wA = a.toLowerCase() === 'color' ? 1 : (a.toLowerCase() === 'size' ? 2 : 3);
                                const wB = b.toLowerCase() === 'color' ? 1 : (b.toLowerCase() === 'size' ? 2 : 3);
                                return wA - wB;
                              })
                              .map(([k, v]) => (
                                <Tag key={k} color="blue">{k.toUpperCase()}: {String(v)}</Tag>
                              ))}
                          </Space>
                        )
                      },
                      {
                        title: "Variant SKU",
                        key: "sku",
                        render: (record, r, idx) => (
                          <Input
                            value={record.sku}
                            onChange={(e) => {
                              const updated = [...variantsList];
                              updated[idx].sku = e.target.value;
                              setVariantsList(updated);
                            }}
                            style={{ borderRadius: 0 }}
                          />
                        )
                      },
                      {
                        title: "Purchase Cost (৳)",
                        key: "purchase",
                        width: 140,
                        render: (record, r, idx) => (
                          <InputNumber
                            value={record.purchase_price}
                            onChange={(val) => {
                              const updated = [...variantsList];
                              updated[idx].purchase_price = val;
                              setVariantsList(updated);
                            }}
                            style={{ width: "100%", borderRadius: 0 }}
                          />
                        )
                      },
                      {
                        title: "Selling Price (৳)",
                        key: "selling",
                        width: 140,
                        render: (record, r, idx) => (
                          <InputNumber
                            value={record.selling_price}
                            onChange={(val) => {
                              const updated = [...variantsList];
                              updated[idx].selling_price = val;
                              setVariantsList(updated);
                            }}
                            style={{ width: "100%", borderRadius: 0 }}
                          />
                        )
                      },
                      {
                        title: "Profit Margin (৳)",
                        key: "margin",
                        width: 120,
                        render: (record) => {
                          const margin = (record.selling_price || 0) - (record.purchase_price || 0);
                          return <span style={{ fontWeight: 600, color: margin >= 0 ? "green" : "red" }}>৳{margin.toFixed(2)}</span>;
                        }
                      },
                      {
                        title: "Active",
                        key: "active",
                        width: 80,
                        render: (record, r, idx) => (
                          <Switch
                            checked={record.is_active}
                            onChange={(val) => {
                              const updated = [...variantsList];
                              updated[idx].is_active = val;
                              setVariantsList(updated);
                            }}
                          />
                        )
                      },
                      {
                        title: "Action",
                        key: "action",
                        width: 60,
                        render: (record, r, idx) => (
                          <Popconfirm title="Delete this variant?" onConfirm={() => {
                              const updated = [...variantsList];
                              updated.splice(idx, 1);
                              setVariantsList(updated);
                            }}>
                            <Button danger type="text" icon={<DeleteOutlined />} />
                          </Popconfirm>
                        )
                      }
                    ]}
                  />
                </div>
              )
            ) },

          /* Tab E: Reusable Templates Content Blocks */
          { label: "Content Templates", key: "templates", forceRender: true, children: (
              <>
              <Form.Item name="size_guide_template_id" label="Size Guide Template Block">
                <Select placeholder="Attach reusable size chart guide template" allowClear>
                  {sizeTemplates.map((t: any) => <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>)}
                </Select>
              </Form.Item>
              <Form.Item name="care_instructions_template_id" label="Wash & Care Template Block">
                <Select placeholder="Attach reusable wash instructions template" allowClear>
                  {careTemplates.map((t: any) => <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>)}
                </Select>
              </Form.Item>
              <Alert message="Editing these attached templates from settings will automatically refresh layouts across all catalog items." type="warning" showIcon />
              </>
            ) }
        ]} />
        </Form>
      </Modal>

      {/* Attribute definition modal */}
      <Modal
        title="Define Global Attribute Schema"
        open={isAttributeModalOpen}
        onCancel={() => setIsAttributeModalOpen(false)}
        onOk={() => attributeForm.submit()}
      >
        <Form form={attributeForm} onFinish={handleAttributeSubmit} layout="vertical">
          <Form.Item name="name" label="Attribute Label" rules={[{ required: true, message: "Please input attribute label!" }]}>
            <Input placeholder="e.g. Fabric Blend" style={{ borderRadius: 0 }} />
          </Form.Item>
          <Form.Item name="code" label="Unique Code Identifier" rules={[{ required: true, message: "Please input code!" }]}>
            <Input placeholder="e.g. fabric_blend" style={{ borderRadius: 0 }} />
          </Form.Item>
          <Form.Item name="type" label="Attribute Type" rules={[{ required: true }]}>
            <Select placeholder="Select data entry type">
              <Select.Option value="text">Text Field</Select.Option>
              <Select.Option value="number">Numeric Field</Select.Option>
              <Select.Option value="boolean">Checkbox Boolean</Select.Option>
              <Select.Option value="select">Dropdown List (Choices)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="choices" label="Dropdown Choices (Comma separated list)">
            <Input placeholder="e.g. 100% Cotton, 80/20 Cotton Poly" style={{ borderRadius: 0 }} />
          </Form.Item>
          <Form.Item name="listing_order" label="Listing Order" initialValue={0}>
            <InputNumber style={{ width: '100%', borderRadius: 0 }} />
          </Form.Item>
        </Form>
      </Modal>
      {/* CRUD Modals */}
      <Modal title="Category" open={isCategoryModalOpen} onCancel={() => setIsCategoryModalOpen(false)} onOk={() => categoryForm.submit()}>
        <Form form={categoryForm} onFinish={handleCategorySubmit} layout="vertical">
          <Form.Item name="name" label="Category Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="slug" label="Slug"><Input /></Form.Item>
          <Form.Item name="is_active" label="Status" valuePropName="checked" initialValue={true}><Switch checkedChildren="Active" unCheckedChildren="Inactive" /></Form.Item>
          <Form.Item name="listing_order" label="Listing Order" initialValue={0}><InputNumber style={{width: '100%'}} /></Form.Item>
          <Form.Item name="parent_id" label="Parent Category">
            <Select allowClear>
              {categories.map((c: any) => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="Category Image (Megamenu Preview)">
            <input 
              type="file" 
              accept="image/*" 
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setCategoryImage(e.target.files[0]);
                }
              }} 
            />
            {editingCategory?.image && !categoryImage && (
              <div style={{ marginTop: 10 }}>
                <img src={editingCategory.image} alt="current" style={{ width: 80, height: 80, objectFit: 'cover' }} />
              </div>
            )}
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Brand" open={isBrandModalOpen} onCancel={() => setIsBrandModalOpen(false)} onOk={() => brandForm.submit()}>
        <Form form={brandForm} onFinish={handleBrandSubmit} layout="vertical">
          <Form.Item name="name" label="Brand Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="slug" label="Slug"><Input /></Form.Item>
          <Form.Item name="listing_order" label="Listing Order" initialValue={0}><InputNumber style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Size Guide Template" open={isSizeModalOpen} onCancel={() => setIsSizeModalOpen(false)} onOk={() => sizeForm.submit()}>
        <Form form={sizeForm} onFinish={handleSizeSubmit} layout="vertical">
          <Form.Item name="name" label="Template Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="headers" label="Columns (comma separated)" rules={[{ required: true }]}><Input placeholder="Size,Chest,Length" /></Form.Item>
          <Form.Item name="rows" label="Rows (CSV format, one per line)" rules={[{ required: true }]}><Input.TextArea rows={4} placeholder={"S,38,28\nM,40,29"} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Wash & Care Template" open={isCareModalOpen} onCancel={() => setIsCareModalOpen(false)} onOk={() => careForm.submit()}>
        <Form form={careForm} onFinish={handleCareSubmit} layout="vertical">
          <Form.Item name="name" label="Template Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="instructions" label="Care Instructions HTML/Rich Text" rules={[{ required: true }]}><Input.TextArea rows={6} /></Form.Item>
        </Form>
      </Modal>

    </Space>
  );
};

export default Catalog;




