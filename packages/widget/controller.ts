import { Controller } from './utils';
import { Component, Water, Param } from '@pjblog/http';
import { HttpNotFoundException } from '@typeservice/exception';
import { BlogTagRelativeEntity, ArticleDBO, numberic, TagDBO, BlogArticleEntity } from '@pjblog/core';
import type RelativeArticle from '.';

interface IArticle {
  title: string,
  id: number,
  code: string,
  ctime: string | Date,
}

type IResponse = IArticle[];

@Controller('GET', '/:id(\\d+)')
export class RelativeArticlesController extends Component<RelativeArticle, IResponse> {
  get manager() {
    return this.container.connection.manager;
  }
  public response(): IResponse {
    return [];
  }

  @Water()
  public getArticle(@Param('id', numberic(0)) id: number) {
    const service = new ArticleDBO(this.manager);
    return async () => {
      if (!id) throw new HttpNotFoundException('找不到文章');
      const article = await service.getOne(id);
      if (!article) throw new HttpNotFoundException('找不到文章');
      return article;
    }
  }

  @Water({ stage: 1 })
  public getTags() {
    const service = new TagDBO(this.manager);
    return async (context: IResponse, article: BlogArticleEntity) => {
      const tags = await service.get(article.id);
      return {
        tids: tags.map(tag => tag.id),
        article,
      }
    }
  }

  @Water({ stage: 2 })
  public getRelatives() {
    return async (context: IResponse, options: { tids: number[], article: BlogArticleEntity }) => {
      if (!options.tids.length) return;
      const res = await this.manager.getRepository(BlogTagRelativeEntity).createQueryBuilder('rel')
        .leftJoin(BlogArticleEntity, 'art', 'art.id=rel.aid')
        .select('art.article_title', 'title')
        .addSelect('art.id', 'id')
        .addSelect('art.article_code', 'code')
        .addSelect('art.gmt_create', 'ctime')
        .distinct()
        .where('rel.tid IN (:...tids)', { tids: options.tids })
        .andWhere('rel.aid<>:aid', { aid: options.article.id })
        .limit(this.container.storage.get('articles'))
        .distinct()
        .getRawMany<IArticle>();
      
      context.push(...res);
    }
  }
}