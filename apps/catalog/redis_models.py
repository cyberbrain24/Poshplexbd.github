from redis_om import JsonModel, Field

class ProductDocument(JsonModel):
    # This acts as the RediSearch index schema for our products
    product_id: int = Field(index=True)
    sku: str = Field(index=True)
    name: str = Field(index=True, full_text_search=True)
    category_id: int = Field(index=True)
    brand_id: int = Field(index=True)
    is_active: int = Field(index=True) # 1 or 0
    price: float = Field(index=True)
    
    class Meta:
        # Connect to the Redis Stack server defined in Django settings
        global_key_prefix = "poshplex:catalog"
        model_key_prefix = "product"
