import 'package:flutter/material.dart';
import 'product.dart';
import 'i18n.dart';

const _green=Color(0xFF176B46);
const _ink=Color(0xFF28374B);
const _muted=Color(0xFF687989);

class StoreGallery extends StatelessWidget {
  const StoreGallery({super.key,required this.products,required this.categories,
    required this.selectedCategory,required this.quantities,required this.favorites,
    required this.onCategorySelected,required this.onProductTap,
    required this.onQuantityChanged,required this.onFavoriteTap});
  final List<Product> products;
  final List<String> categories;
  final String selectedCategory;
  final Map<String,int> quantities;
  final Set<String> favorites;
  final ValueChanged<String> onCategorySelected;
  final ValueChanged<Product> onProductTap;
  final void Function(Product,int) onQuantityChanged;
  final ValueChanged<Product> onFavoriteTap;

  String _categoryIcon(String name){
    final value=name.toLowerCase();
    if(value=='all')return '🛒';
    if(value.contains('fruit'))return '🍎';
    if(value.contains('leaf')||value.contains('green'))return '🥬';
    if(value.contains('essential')||value.contains('grocery'))return '🧄';
    if(value.contains('vegetable'))return '🥕';
    if(value.contains('premium')||value.contains('exotic'))return '🥑';
    return '🥬';
  }

  Widget _category(String name){
    final selected=name==selectedCategory;
    return Semantics(button:true,selected:selected,child:InkWell(
      borderRadius:BorderRadius.circular(14),onTap:()=>onCategorySelected(name),
      child:AnimatedContainer(duration:const Duration(milliseconds:180),
        padding:const EdgeInsets.symmetric(horizontal:3,vertical:11),
        decoration:BoxDecoration(color:selected?const Color(0xFFE4EFFF):Colors.transparent,
          borderRadius:BorderRadius.circular(14),
          border:Border.all(color:selected?const Color(0xFFBDD7F3):Colors.transparent)),
        child:Column(mainAxisSize:MainAxisSize.min,children:[
          Container(height:46,width:46,alignment:Alignment.center,
            decoration:BoxDecoration(color:selected?Colors.white:const Color(0xFFF4F8FC),
              borderRadius:BorderRadius.circular(15)),
            child:Text(_categoryIcon(name),style:const TextStyle(fontSize:26))),
          const SizedBox(height:6),
          Text(categoryText(name),maxLines:2,overflow:TextOverflow.ellipsis,
            textAlign:TextAlign.center,style:TextStyle(fontSize:11.5,height:1.12,
              fontWeight:selected?FontWeight.w800:FontWeight.w500,
              color:selected?const Color(0xFF2258A0):_ink)),
        ]))));
  }

  Widget _photo(Product p){
    final fallback=Container(alignment:Alignment.center,color:const Color(0xFFEFF5EA),
      child:Text(p.emoji,style:const TextStyle(fontSize:58)));
    if(p.imageUrl.isEmpty)return fallback;
    return Image.network(p.imageUrl,fit:BoxFit.cover,width:double.infinity,
      errorBuilder:(_,__,___)=>fallback,
      loadingBuilder:(context,image,progress)=>progress==null?image:fallback);
  }

  Widget _tile(Product p){
    final amount=quantities[p.id]??0;
    final selected=favorites.contains(p.id);
    return Material(color:Colors.white,borderRadius:BorderRadius.circular(15),
      clipBehavior:Clip.antiAlias,child:InkWell(onTap:()=>onProductTap(p),
      child:Padding(padding:const EdgeInsets.all(5),child:Column(
        crossAxisAlignment:CrossAxisAlignment.start,children:[
          Expanded(child:Stack(fit:StackFit.expand,children:[
            ClipRRect(borderRadius:BorderRadius.circular(12),child:_photo(p)),
            if(!p.available)Positioned.fill(child:DecoratedBox(decoration:BoxDecoration(
              color:Colors.white.withValues(alpha:0.58),
              borderRadius:BorderRadius.circular(12)))),
            if(!p.available)Positioned(top:0,left:0,child:Container(
              padding:const EdgeInsets.symmetric(horizontal:6,vertical:5),
              decoration:const BoxDecoration(color:Color(0xFFE8ECF1),
                borderRadius:BorderRadius.only(bottomRight:Radius.circular(9))),
              child:Text(tr('Sold out','स्टॉक खत्म'),style:const TextStyle(fontSize:10,color:_ink)))),
            Positioned(top:1,right:1,child:Material(color:Colors.white.withValues(alpha:0.95),
              shape:const CircleBorder(),child:IconButton(
                tooltip:selected?tr('Remove favorite','पसंदीदा हटाएँ'):tr('Add favorite','पसंदीदा जोड़ें'),
                visualDensity:VisualDensity.compact,icon:Icon(
                  selected?Icons.favorite:Icons.favorite_border,
                  size:21,color:const Color(0xFFD82971)),onPressed:()=>onFavoriteTap(p)))),
            Positioned(left:5,right:5,bottom:5,child:SizedBox(height:36,
              child:!p.available?Container(
                alignment:Alignment.center,
                decoration:BoxDecoration(color:Colors.white,
                  borderRadius:BorderRadius.circular(10),
                  border:Border.all(color:const Color(0xFFC7D0DA))),
                child:Text(tr('Unavailable','उपलब्ध नहीं'),
                  style:const TextStyle(color:_muted,fontWeight:FontWeight.bold,fontSize:11)))
              :amount==0?OutlinedButton(
                style:OutlinedButton.styleFrom(backgroundColor:Colors.white,
                  foregroundColor:_green,side:const BorderSide(color:_green,width:1.5),
                  padding:EdgeInsets.zero,shape:RoundedRectangleBorder(
                    borderRadius:BorderRadius.circular(10))),
                onPressed:()=>onQuantityChanged(p,1),
                child:Text(tr('ADD','जोड़ें'),style:const TextStyle(fontWeight:FontWeight.w900)))
              :Container(
                decoration:BoxDecoration(color:Colors.white,
                  border:Border.all(color:_green,width:1.5),
                  borderRadius:BorderRadius.circular(10)),
                child:Row(mainAxisAlignment:MainAxisAlignment.spaceEvenly,children:[
                  InkWell(onTap:()=>onQuantityChanged(p,-1),child:const Icon(Icons.remove,color:_green,size:20)),
                  Text('$amount',style:const TextStyle(color:_green,fontWeight:FontWeight.w800)),
                  InkWell(onTap:amount>=99?null:()=>onQuantityChanged(p,1),
                    child:const Icon(Icons.add,color:_green,size:20)),
                ])))),
          ])),
          const SizedBox(height:6),
          Wrap(spacing:5,runSpacing:2,crossAxisAlignment:WrapCrossAlignment.center,children:[
            Container(padding:const EdgeInsets.symmetric(horizontal:5,vertical:3),
              decoration:BoxDecoration(color:const Color(0xFFE0F4E7),
                borderRadius:BorderRadius.circular(6)),
              child:Text('₹${p.price}',style:const TextStyle(color:_green,
                fontSize:14,fontWeight:FontWeight.w900))),
            if(p.compareAtPrice!=null)Text('₹${p.compareAtPrice}',
              style:const TextStyle(color:_muted,fontSize:11,
                decoration:TextDecoration.lineThrough)),
          ]),
          if(p.savings>0)Text(tr('Save ₹${p.savings}','₹${p.savings} की बचत'),
            maxLines:1,overflow:TextOverflow.ellipsis,
            style:const TextStyle(fontSize:10,fontWeight:FontWeight.bold,
              color:Color(0xFF18834C))),
          const SizedBox(height:5),
          Text(productName(p.name,p.hindi),maxLines:2,overflow:TextOverflow.ellipsis,
            style:TextStyle(color:p.available?_ink:_muted,fontSize:12.5,
              height:1.12,fontWeight:FontWeight.w800)),
          const SizedBox(height:3),
          Text(p.unit,maxLines:1,overflow:TextOverflow.ellipsis,
            style:const TextStyle(color:_muted,fontSize:11)),
          if(p.description.isNotEmpty)Text(productDescription(p.description),
            maxLines:1,overflow:TextOverflow.ellipsis,
            style:const TextStyle(color:_muted,fontSize:10)),
        ]))));
  }

  @override Widget build(BuildContext context)=>LayoutBuilder(builder:(ctx,bounds){
    final rail=bounds.maxWidth<370?80.0:98.0;
    final gridSpace=bounds.maxWidth-rail-20;
    final cols=gridSpace>=750?4:gridSpace>=485?3:2;
    final width=(gridSpace-10*(cols-1))/cols;
    final height=width.clamp(120.0,185.0)+112.0;
    return Row(children:[
      SizedBox(width:rail,child:DecoratedBox(
        decoration:const BoxDecoration(color:Colors.white,
          border:Border(right:BorderSide(color:Color(0xFFE3EAF0)))),
        child:ListView.separated(
          padding:const EdgeInsets.symmetric(horizontal:4,vertical:10),
          itemCount:categories.length,
          separatorBuilder:(_,__)=>const SizedBox(height:5),
          itemBuilder:(_,i)=>_category(categories[i])))),
      Expanded(child:products.isEmpty?Center(child:Padding(
        padding:const EdgeInsets.all(15),
        child:Text(tr('No matching products','कोई मिलता उत्पाद नहीं'),
          textAlign:TextAlign.center)))
        :CustomScrollView(slivers:[
          SliverPadding(padding:const EdgeInsets.fromLTRB(10,10,10,16),
            sliver:SliverGrid.builder(itemCount:products.length,
              gridDelegate:SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount:cols,mainAxisExtent:height,
                mainAxisSpacing:10,crossAxisSpacing:10),
              itemBuilder:(_,i)=>_tile(products[i]))),
        ])),
    ]);
  });
}
